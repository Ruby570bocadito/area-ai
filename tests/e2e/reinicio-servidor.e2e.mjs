#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-reinicio-servidor — agente TEST (protocolo v2)
//
//   bun tests/e2e/reinicio-servidor.e2e.mjs
//
// Mata el servidor con SIGKILL a mitad de una campaña REAL y
// verifica el ciclo completo de recuperación de campañas
// huérfanas contra una instancia local con BD dedicada
// (no toca db/custom.db):
//   F1 · campaña real RUNNING con ≥ 1 evento → kill -9 a mitad
//   F2 · reinicio sobre la MISMA BD: la fila RUNNING sobrevive,
//        y el umbral de 120 s de recoverOrphanCampaigns NO
//        recupera a la huérfana fresca (protege campañas vivas)
//   F3 · POST con huérfana → 409 «Ya hay una campaña en curso»
//        (defecto H-002, documentado como tal mientras siga
//        abierto: un cliente solo-POST queda bloqueado)
//   F4 · superado el umbral (último evento retrodatado +130 s —
//        manipulación honesta del reloj, patrón volumen),
//        GET /api/state dispara la recuperación → ABORTED con
//        endedAt y eventos PRESERVADOS
//   F5 · POST desbloqueado → 200, campaña nueva COMPLETED
//        conviviendo con la huérfana en el archivo (2 filas)
//
// Nota de entorno (lección sesión 9, adoptada por DIR en la 13ª):
// la suite REUTILIZA .next/standalone si existe — para verificar
// el main actual, el llamador (o CI) DEBE forzar build fresco
// antes de la ronda e2e.
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { Database } from 'bun:sqlite'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-reinicio.db`
const BASE = `http://127.0.0.1:${PORT}`
const TECHO_PRIMER_EVENTO_S = 120 // espera máxima a que la campaña real produzca su 1er evento
const TECHO_COMPLETADO_S = Number(process.env.E2E_CAMPAIGN_TIMEOUT || 300)
const UMBRAL_ORFANAS_MS = 130_000 // +10 s sobre el umbral real de 120 s del motor
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

const post = (body) =>
  fetch(`${BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))

const detail = (id) =>
  fetch(`${BASE}/api/campaigns/${id}`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))

const vivo = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ── BD dedicada ──────────────────────────────────────────────
rmSync(DB_PATH, { force: true })
rmSync(`${DB_PATH}-journal`, { force: true })
const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: 'pipe',
  encoding: 'utf8',
})
record('prisma db push (BD dedicada)', push.status === 0, push.status === 0 ? DB_PATH : push.stderr.slice(-300))

const serverJs = resolve(ROOT, '.next/standalone/server.js')
if (!existsSync(serverJs)) {
  console.log('standalone ausente: construyendo…')
  const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  if (built.status === 0) {
    cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
    cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
  }
  record('build de producción', built.status === 0)
}

const levantar = () => {
  const proc = spawn('bun', [serverJs], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}`, PORT: String(PORT), LAB_PORT: String(LAB_PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  proc.stdout.on('data', (d) => (log += d))
  proc.stderr.on('data', (d) => (log += d))
  proc._log = () => log
  return proc
}

const esperarArriba = async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await fetch(`${BASE}/api`).then((r) => r.ok).catch(() => false)) return true
  }
  return false
}

// ── FASE 0 — primer arranque ─────────────────────────────────
const server1 = levantar()
const up1 = await esperarArriba()
record('servidor 1 (antes del reinicio) responde', up1, up1 ? BASE : `no arrancó en 30s\n${server1._log().slice(-500)}`)

let idOrfana = null
let scenarioId = null
if (up1) {
  const state = await fetch(`${BASE}/api/state`).then((r) => r.json()).catch(() => null)
  const escenarios = Array.isArray(state?.scenarios) ? state.scenarios : []
  scenarioId = escenarios[0]?.id ?? null
  record('roster con escenarios del seed (scenarioId explícito, blinda frente a H-006)', !!scenarioId, `escenarios=${escenarios.length} elegido=${escenarios[0]?.codename ?? '—'}`)

  // ── FASE 1 — campaña real + kill a mitad ───────────────────
  const lanzamiento = await post({ scenarioId })
  idOrfana = lanzamiento.body?.campaignId ?? null
  record('POST lanza campaña REAL (200)', lanzamiento.status === 200 && !!idOrfana, `${lanzamiento.status} campaña ${idOrfana ?? 'ninguna'}`)

  if (idOrfana) {
    // Pollar hasta el momento «mitad de campaña»: RUNNING con ≥ 1 evento
    const deadline = Date.now() + TECHO_PRIMER_EVENTO_S * 1000
    let snapshot = null
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000))
      const d = await detail(idOrfana)
      if (d.status === 200 && d.body?.ok && d.body?.campaign?.status === 'RUNNING' && (d.body?.events?.length ?? 0) >= 1) {
        snapshot = d.body
        break
      }
      if (d.status === 200 && d.body?.ok && d.body?.campaign?.status !== 'RUNNING') break // se abortó/terminó sola: no sirve para la huérfana
    }
    record('campaña alcanzó RUNNING con ≥ 1 evento (mitad de campaña real)', !!snapshot, snapshot ? `eventos=${snapshot.events.length}` : `no llegó en ${TECHO_PRIMER_EVENTO_S}s (¿abortó sola? revisar H-006)`)

    // kill -9 a mitad REAL — bun standalone ignora SIGTERM (lección sesión 7)
    const pid1 = server1.pid
    process.kill(pid1, 'SIGKILL')
    await new Promise((r) => setTimeout(r, 700))
    record('servidor 1 MUERTO tras SIGKILL (signal-0)', !vivo(pid1), `pid=${pid1}`)
  }
}

if (!idOrfana) {
  console.log('\nNo se pudo crear la huérfana: no hay ciclo que verificar.')
  server1.kill('SIGKILL')
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
  if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
  process.exit(0)
}

// ── FASE 2 — reinicio sobre la MISMA BD ──────────────────────
const server2 = levantar()
const up2 = await esperarArriba()
record('servidor 2 (mismo puerto, misma DATABASE_URL) responde', up2, up2 ? BASE : `no arrancó en 30s\n${server2._log().slice(-500)}`)

if (up2) {
  const d = await detail(idOrfana)
  const huérfana = d.body?.campaign
  record('fila huérfana SOBREVIVE al reinicio: detail 200 y sigue RUNNING', d.status === 200 && huérfana?.status === 'RUNNING', `status=${d.status} estado=${huérfana?.status ?? '—'}`)
  record('eventos de la huérfana intactos tras el reinicio', (d.body?.events?.length ?? 0) >= 1, `eventos=${d.body?.events?.length ?? 0}`)

  // El umbral de 120 s PROTEGE: huérfana fresca (último evento < 120 s) no se recupera
  const estado = await fetch(`${BASE}/api/state`).then((r) => r.json()).catch(() => null)
  const enArchivo = Array.isArray(estado?.campaigns) ? estado.campaigns.find((c) => c.id === idOrfana) : null
  record('GET /api/state con huérfana fresca: el umbral de 120 s NO recupera (sigue RUNNING)', enArchivo?.status === 'RUNNING', `estado en state=${enArchivo?.status ?? '—'}`)

  // ── FASE 3 — el defecto H-002, documentado como tal ────────
  const bloqueo = await post({ scenarioId })
  record('POST con huérfana → 409 «Ya hay una campaña en curso» (H-002 vigente)', bloqueo.status === 409 && bloqueo.body?.ok === false, `${bloqueo.status} ${bloqueo.body?.error ?? ''}`)
  const bloqueo2 = await post({ scenarioId })
  record('POST de nuevo → 409 otra vez (cliente solo-POST bloqueado indefinidamente)', bloqueo2.status === 409, `${bloqueo2.status}`)

  // ── FASE 4 — recuperación por el camino real (umbral superado) ──
  // Retrodatar el último evento +130 s: el umbral lee createdAt de BD;
  // la suite de volumen ya retrodata startedAt con la misma honestidad.
  const bd = new Database(DB_PATH)
  const backdate = bd.prepare(`UPDATE CampaignEvent SET createdAt = datetime('now', '-130 seconds') WHERE campaignId = ? AND seq = (SELECT MAX(seq) FROM CampaignEvent WHERE campaignId = ?)`).run(idOrfana, idOrfana)
  bd.close()
  record('último evento de la huérfana retrodatado +130 s (manipulación honesta del reloj)', backdate.changes === 1, `filas=${backdate.changes}`)

  await fetch(`${BASE}/api/state`).then((r) => r.json()).catch(() => null)
  const tras = await detail(idOrfana)
  record('recoverOrphanCampaigns disparado por /api/state: huérfana → ABORTED', tras.body?.campaign?.status === 'ABORTED', `estado=${tras.body?.campaign?.status ?? '—'} endedAt=${tras.body?.campaign?.endedAt ?? '—'}`)
  record('endedAt sellado y eventos PRESERVADOS (la recuperación no borra datos)', !!tras.body?.campaign?.endedAt && (tras.body?.events?.length ?? 0) >= 1, `endedAt=${tras.body?.campaign?.endedAt ? 'sí' : 'no'} eventos=${tras.body?.events?.length ?? 0}`)

  // ── FASE 5 — el desbloqueo ─────────────────────────────────
  const reintentos = []
  let id2 = null
  for (let i = 0; i < 3 && !id2; i++) {
    const intento = await post({ scenarioId })
    reintentos.push(intento.status)
    if (intento.status === 200) id2 = intento.body?.campaignId ?? null
  }
  record('POST tras la recuperación → 200 con campaña nueva (ciclo desbloqueado)', !!id2, `status=${reintentos.join('/')} campaña=${id2 ?? 'ninguna'}`)

  if (id2) {
    const deadline = Date.now() + TECHO_COMPLETADO_S * 1000
    let fin = null
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000))
      const d2 = await detail(id2)
      if (d2.status === 200 && d2.body?.ok && d2.body?.campaign?.status !== 'RUNNING') { fin = d2.body; break }
    }
    record('campaña nueva COMPLETED conviviendo con la huérfana', fin?.campaign?.status === 'COMPLETED', fin ? `estado ${fin.campaign.status} · eventos=${fin.events?.length ?? 0}` : `timeout ${TECHO_COMPLETADO_S}s`)

    const archivo = await fetch(`${BASE}/api/campaigns`).then((r) => r.json()).catch(() => null)
    const total = Array.isArray(archivo?.campaigns) ? archivo.campaigns.length : -1
    record('archivo con exactamente 2 campañas (ABORTED + COMPLETED, sin duplicados)', total === 2, `campañas=${total}`)
  }
}

// ── Apagado con verificación por PID (patrón sesión 7) ───────
server2.kill('SIGTERM')
await new Promise((r) => setTimeout(r, 2000))
if (vivo(server2.pid)) {
  process.kill(server2.pid, 'SIGKILL')
  await new Promise((r) => setTimeout(r, 500))
}
record('servidor 2 apagado de verdad (PID signal-0)', !vivo(server2.pid), `pid=${server2.pid}`)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
