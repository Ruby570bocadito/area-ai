#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-doble-lanzamiento — agente TEST (protocolo v2)
//
//   bun tests/e2e/doble-lanzamiento.e2e.mjs
//
// Verifica el cerrojo de una campaña a la vez contra una instancia
// local con BD dedicada (no toca db/custom.db):
//   (1) POST /api/campaigns lanza una campaña (200)
//   (2) POST simultáneos mientras corre → NINGÚN segundo lanzamiento:
//       409 (guard RUNNING del motor) o replay idempotente de la MISMA
//       campaña (dedupe en servidor, ventana 5 s — idempotencia-
//       lanzamiento: 200 + Idempotency-Replay + campaignId original)
//   (3) POST secuencial mientras corre → igual: 409 o replay
//   (4) al terminar la campaña, POST → 200 con NUEVA campaña (sin replay)
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-doble.db`
const BASE = `http://127.0.0.1:${PORT}`
const TIMEOUT_S = Number(process.env.E2E_CAMPAIGN_TIMEOUT || 300)
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
  }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
    replay: r.headers.get('Idempotency-Replay') === 'true',
  }))

// ── BD dedicada + standalone ────────────────────────────────
// BD determinista: restos de una corrida fallida previa no deben
// envenenar la siguiente («exactamente 2 campañas» exige arranque limpio).
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
const server = spawn('bun', [serverJs], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}`, PORT: String(PORT), LAB_PORT: String(LAB_PORT), NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))

let up = false
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500))
  up = await fetch(`${BASE}/api`).then((r) => r.ok).catch(() => false)
}
record('servidor standalone responde', up, up ? BASE : `no arrancó en 30s\n${serverLog.slice(-500)}`)

if (up) {
  // ── (1) primera campaña ────────────────────────────────────
  const first = await post({})
  const id = first.body?.campaignId
  record('primer POST lanza campaña (200)', first.status === 200 && !!id, `campaña ${id ?? 'ninguna'}`)

  if (id) {
    // ── (2) doble lanzamiento simultáneo ─────────────────────
    const [a, b] = await Promise.all([post({}), post({})])
    // Contrato ACTUAL (idempotencia-lanzamiento): el POST repetido con
    // cuerpo idéntico en ventana corta (5 s) recibe el REPLAY de la
    // respuesta original — 200 + Idempotency-Replay + la MISMA campaña —
    // sin lanzar una segunda; fuera de ventana (o con otro cuerpo) cae
    // en el guard RUNNING del motor (409). Invariante de la suite:
    // NINGÚN segundo lanzamiento real.
    const sinSegundo = (x) =>
      x.status === 409 || (x.status === 200 && x.replay && x.body?.campaignId === id)
    record(
      'doble POST simultáneo: ningún segundo lanzamiento (409 o replay de la misma campaña)',
      sinSegundo(a) && sinSegundo(b),
      `${a.status}/${b.status}${a.replay ? ' replay' : ''}${b.replay ? ' replay' : ''}`
    )
    const replays = [a, b].filter((x) => x.status === 200 && x.replay && x.body?.campaignId === id).length
    record('el doble clic recibe el replay de la MISMA campaña (Idempotency-Replay + id original)', replays === 2, `replays=${replays}/2`)

    // ── (3) POST secuencial mientras corre ───────────────────
    const seq = await post({})
    record(
      'POST secuencial mientras corre: 409 o replay de la misma campaña (sin 2º lanzamiento)',
      sinSegundo(seq),
      `${seq.status}${seq.replay ? ' replay' : ''}`
    )

    // ── (4) tras terminar, se vuelve a poder lanzar ──────────
    const deadline = Date.now() + TIMEOUT_S * 1000
    let finished = false
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await fetch(`${BASE}/api/campaigns/${id}`).then((r) => r.json()).catch(() => null)
      if (res?.ok && res.campaign?.status !== 'RUNNING') { finished = res.campaign.status === 'COMPLETED'; break }
    }
    record('campaña inicial COMPLETED', finished, `techo ${TIMEOUT_S}s`)

    const again = await post({})
    record(
      'POST tras finalizar → 200 con NUEVA campaña (fuera de ventana, sin replay)',
      again.status === 200 && !!again.body?.campaignId && again.body?.campaignId !== id && !again.replay,
      `${again.status} ${again.body?.campaignId ?? ''}`
    )

    const archivo = await fetch(`${BASE}/api/campaigns`).then((r) => r.json()).catch(() => null)
    const total = Array.isArray(archivo?.campaigns) ? archivo.campaigns.length : -1
    record('archivo con exactamente 2 campañas (sin duplicados del doble clic)', total === 2, `campañas=${total}`)
  }
}

server.kill('SIGTERM')
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
