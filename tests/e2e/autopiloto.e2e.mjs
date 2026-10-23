#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-autopiloto — agente TEST (protocolo v2)
//
//   bun tests/e2e/autopiloto.e2e.mjs
//
// Modo de operación continua en dos capas (BD dedicada, no toca
// db/custom.db):
//
//   FASE A — contrato HTTP real de /api/autopilot:
//     · activar/desactivar con booleano real y eco en GET y /api/state
//     · coerción ESTRICTA del cuerpo: solo el literal true activa;
//       "true"/"false" en cadena, 1, null y body sin campo DESACTIVAN
//       (bug histórico Ronda 12: Boolean("false")===true activaba el
//       gasto LLM en bucle)
//     · barreras en orden: CSRF 403 (incluso con cuerpo que excede el
//       tope) → 413 cuerpo >1 KB → 400 JSON inválido; ninguna petición
//       rechazada muta el estado
//
//   FASE B — semántica de maybeRunAutopilot con campañas REALES,
//     ejercitada exactamente como en producción: sondeos a /api/state
//     (cada sondeo ejecuta el bucle, sin hilos ni temporizadores):
//     · OFF → nunca arranca nada
//     · ON + motor ocioso → arranca exactamente una campaña RUNNING
//     · guard RUNNING → con campaña viva no arranca una segunda
//     · cooldown 12 s desde endedAt → ningún sondeo dentro de la
//       ventana incrementa el archivo; al expirar arranca la siguiente
//       (comprobado con startedAt ≥ endedAt + 12 s)
//     · desactivación en caliente → la campaña en curso termina de
//       forma natural y con motor ocioso + cooldown vencido no arranca
//       nada nuevo
//
//   FASE C — rate limit del bucket admin: (30/min): ráfaga de 35 POST
//     same-origin sin credencial → solo 200 y 429, tope respetado y
//     cola de la ráfaga rechazada (el límite va antes del auth, bugs-11)
//
// El build del standalone es SIEMPRE sobre main actual (fidelidad al
// esquema y motor vigentes; el standalone de una sesión anterior puede
// llevar un esquema desactualizado).
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-autopiloto.db`
const BASE = `http://127.0.0.1:${PORT}`
const TIMEOUT_S = Number(process.env.E2E_CAMPAIGN_TIMEOUT || 300)
const COOLDOWN_MS = 12_000 // espejo de src/lib/sim/autopilot.ts
const MARGEN_MS = 300 // latencia local admitida en las comparaciones de reloj
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function post(body, headers = {}) {
  const res = await fetch(`${BASE}/api/autopilot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch { /* cuerpo no JSON en respuestas de barrera */ }
  return { status: res.status, json }
}

async function getAutopilot() {
  const res = await fetch(`${BASE}/api/autopilot`).then((r) => r.json()).catch(() => null)
  return res?.ok ? !!res.enabled : null
}

async function getState() {
  return fetch(`${BASE}/api/state`).then((r) => r.json()).catch(() => null)
}

async function getDetail(id) {
  return fetch(`${BASE}/api/campaigns/${id}`).then((r) => r.json()).catch(() => null)
}

// Sondeos de /api/state hasta que se cumple la condición — cada sondeo
// EJECUTA maybeRunAutopilot, el mismo mecanismo que mueve la UI real.
async function pollState(cond, timeoutMs = 12_000, cadaMs = 1_500) {
  const fin = Date.now() + timeoutMs
  while (Date.now() < fin) {
    const before = Date.now()
    const st = await getState()
    if (st?.ok && cond(st, before)) return { st, before }
    await sleep(cadaMs)
  }
  return null
}

// Espera el fin de una campaña por su detalle — NO sondea /api/state,
// así el autopiloto no se mueve mientras se observa.
async function esperarFin(id) {
  const fin = Date.now() + TIMEOUT_S * 1000
  while (Date.now() < fin) {
    await sleep(2_000)
    const d = await getDetail(id)
    if (d?.ok && d.campaign?.status !== 'RUNNING') return d
  }
  return null
}

// ═════════════════════════════════════════════════════════════
// FASE A — contrato HTTP del endpoint
// ═════════════════════════════════════════════════════════════

async function faseA() {
  const inicial = await getAutopilot()
  record('http · GET inicial en BD limpia → enabled:false', inicial === false, `enabled=${inicial}`)

  const on = await post({ enabled: true })
  record('http · POST {enabled:true} → 200 y eco enabled:true', on.status === 200 && on.json?.ok === true && on.json?.enabled === true, `status=${on.status}`)
  record('http · GET tras activar → enabled:true', (await getAutopilot()) === true, '')
  // Nota: aquí NO se sondea /api/state — con el modo ON y motor ocioso,
  // cualquier sondeo EJECUTA el bucle y arrancaría una campaña real (es
  // el comportamiento que la fase B verifica). El eco ON en /api/state
  // se comprueba en fase B, con la campaña que ese mismo sondeo arranca.

  // Coerción estricta: SOLO el literal true activa; cualquier otra cosa desactiva.
  const coerciones = [
    ['"true" en cadena', { enabled: 'true' }],
    ['"false" en cadena (el bug histórico la activaba)', { enabled: 'false' }],
    ['número 1', { enabled: 1 }],
    ['null', { enabled: null }],
    ['cuerpo sin campo enabled', {}],
  ]
  for (const [nombre, cuerpo] of coerciones) {
    const r = await post(cuerpo)
    const estado = await getAutopilot()
    record(`coerción · ${nombre} → desactiva (200 enabled:false)`, r.status === 200 && r.json?.enabled === false && estado === false, `status=${r.status} enabled=${estado}`)
  }
  const react = await post({ enabled: true })
  record('coerción · literal true (booleano real) → activa', react.status === 200 && react.json?.enabled === true && (await getAutopilot()) === true, `status=${react.status}`)

  // Tope de cuerpo y JSON inválido — ninguna petición rechazada muta el estado
  const grande = await post({ enabled: true, pad: 'x'.repeat(2048) })
  record('http · cuerpo >1 KB → 413 (tope readJsonBody antes de parsear)', grande.status === 413, `status=${grande.status}`)
  const invalido = await post('{enabled:')
  record('http · JSON inválido → 400', invalido.status === 400, `status=${invalido.status}`)
  record('http · peticiones rechazadas no mutan el estado (sigue activo)', (await getAutopilot()) === true, '')

  // CSRF: la barrera va primero, incluso con cuerpo que excede el tope
  const csrf = await post({ enabled: true, pad: 'x'.repeat(2048) }, { origin: 'https://evil.example', 'content-type': 'text/plain' })
  record('http · cross-origin (Origin: https://evil.example) → 403 aunque el cuerpo exceda el tope', csrf.status === 403, `status=${csrf.status}`)
  record('http · tras el 403 el estado no cambia', (await getAutopilot()) === true, '')

  // Reset a OFF para la fase semántica + eco OFF en /api/state (sondeo
  // seguro: con OFF el bucle no arranca nada)
  const off = await post({ enabled: false })
  record('http · POST {enabled:false} → desactiva (reset para fase B)', off.status === 200 && off.json?.enabled === false && (await getAutopilot()) === false, `status=${off.status}`)
  const stOff = await getState()
  record('http · /api/state refleja autopilot:false (y archivo vacío)', stOff?.autopilot === false && stOff.campaigns?.length === 0, `autopilot=${stOff?.autopilot} campañas=${stOff?.campaigns?.length}`)
}

// ═════════════════════════════════════════════════════════════
// FASE B — semántica del bucle con campañas reales
// ═════════════════════════════════════════════════════════════

async function faseB() {
  // OFF: el bucle no debe hacer NADA
  let okOff = true
  for (let i = 0; i < 3; i++) {
    const st = await getState()
    if (!st?.ok || st.campaigns?.length !== 0 || st.activeCampaign) okOff = false
    await sleep(1_500)
  }
  record('bucle · autopiloto OFF: tres sondeos no arrancan ninguna campaña', okOff, '')

  const on = await post({ enabled: true })
  record('bucle · activar modo continuo (POST 200 enabled:true)', on.status === 200 && on.json?.enabled === true, `status=${on.status}`)

  // Motor ocioso, sin histórico → el primer sondeo arranca la campaña 1
  const primera = await pollState((s) => s.activeCampaign && s.campaigns?.length === 1, 10_000, 1_500)
  const id1 = primera?.st?.activeCampaign?.id ?? null
  record('bucle · motor ocioso → arranca exactamente una campaña RUNNING', !!id1 && primera.st.activeCampaign.status === 'RUNNING', `id=${id1 ?? '—'}`)
  record('bucle · /api/state refleja autopilot:true en el sondeo que arranca', primera?.st?.autopilot === true, `autopilot=${primera?.st?.autopilot}`)

  // Guard RUNNING: con campaña viva no arranca una segunda
  let guardOk = true
  for (let i = 0; i < 2; i++) {
    await sleep(3_000)
    const s = await getState()
    if (!s?.ok || s.campaigns?.length !== 1 || s.activeCampaign?.id !== id1) guardOk = false
  }
  record('bucle · guard RUNNING: sondeos con campaña viva no arrancan una segunda', guardOk, '')

  // La campaña 1 es real: corre y deja telemetría
  const fin1 = await esperarFin(id1)
  const ended1 = fin1?.campaign?.endedAt ? new Date(fin1.campaign.endedAt).getTime() : null
  record('bucle · campaña 1 completada con eventos reales del motor', fin1?.ok === true && fin1.campaign?.status === 'COMPLETED' && (fin1.events?.length ?? 0) > 0 && !!ended1, `status=${fin1?.campaign?.status ?? '—'} eventos=${fin1?.events?.length ?? '—'}`)

  // Cooldown: ningún sondeo dentro de la ventana de 12 s incrementa el archivo
  const enCooldown = []
  for (let i = 0; i < 5; i++) {
    const before = Date.now()
    const s = await getState()
    enCooldown.push({ before, n: s?.campaigns?.length ?? -1 })
    await sleep(1_000)
  }
  const dentroVentana = enCooldown.filter((s) => s.before < ended1 + COOLDOWN_MS - MARGEN_MS)
  record('bucle · cooldown: todo sondeo dentro de los 12 s posteriores deja el archivo en 1', dentroVentana.length >= 3 && dentroVentana.every((s) => s.n === 1), `sondeos en ventana=${dentroVentana.length} tamaños=${dentroVentana.map((s) => s.n).join(',')}`)

  // Al expirar la ventana arranca exactamente la segunda
  const cruce = await pollState((s, before) => before >= ended1 + COOLDOWN_MS + MARGEN_MS && s.campaigns?.length === 2, 12_000, 1_000)
  const id2 = cruce?.st?.activeCampaign?.id ?? null
  record('bucle · al expirar el cooldown arranca exactamente una segunda campaña', !!id2 && id2 !== id1 && cruce.st.campaigns?.length === 2, `id=${id2 ?? '—'}`)

  // La campaña 2 nació después de la ventana (startedAt ≥ ended1 + 12 s)
  const d2 = id2 ? await getDetail(id2) : null
  const started2 = d2?.campaign?.startedAt ? new Date(d2.campaign.startedAt).getTime() : null
  record('bucle · la segunda campaña nació tras la ventana (startedAt ≥ ended1 + 12 s)', !!started2 && started2 >= ended1 + COOLDOWN_MS - MARGEN_MS, `startedAt-${ended1}=${started2 ? started2 - ended1 : '—'} ms`)

  // Desactivación en caliente con campaña en curso
  const offEnCaliente = await post({ enabled: false })
  record('bucle · desactivación en caliente con campaña en curso → 200 enabled:false', offEnCaliente.status === 200 && offEnCaliente.json?.enabled === false, `status=${offEnCaliente.status}`)

  // La campaña en curso no la corta el OFF: termina de forma natural
  const fin2 = await esperarFin(id2)
  const ended2 = fin2?.campaign?.endedAt ? new Date(fin2.campaign.endedAt).getTime() : null
  record('bucle · la campaña en curso al desactivar termina de forma natural con eventos', fin2?.ok === true && fin2.campaign?.status === 'COMPLETED' && (fin2.events?.length ?? 0) > 0, `status=${fin2?.campaign?.status ?? '—'} eventos=${fin2?.events?.length ?? '—'}`)

  // OFF definitivo: motor ocioso + cooldown vencido → no arranca nada nuevo
  const restante = ended2 + COOLDOWN_MS + 1_500 - Date.now()
  if (restante > 0) await sleep(restante)
  let okOffFinal = true
  for (let i = 0; i < 2; i++) {
    const s = await getState()
    if (!s?.ok || s.campaigns?.length !== 2 || s.activeCampaign) okOffFinal = false
    await sleep(1_500)
  }
  record('bucle · OFF con motor ocioso y cooldown vencido: dos sondeos no arrancan nada nuevo', okOffFinal, `campañas=${(await getState())?.campaigns?.length}`)
}

// ═════════════════════════════════════════════════════════════
// FASE C — rate limit del bucket admin: (30/min)
// ═════════════════════════════════════════════════════════════

async function faseC() {
  const RAFAGA = 35
  const codigos = []
  for (let i = 0; i < RAFAGA; i++) {
    const r = await post({ enabled: true })
    codigos.push(r.status)
  }
  const ok200 = codigos.filter((c) => c === 200).length
  const ok429 = codigos.filter((c) => c === 429).length
  record('rate-limit · ráfaga de 35 POST same-origin sin credencial: solo 200 y 429', ok200 + ok429 === RAFAGA, `200=${ok200} 429=${ok429}`)
  record('rate-limit · tope del bucket admin: respetado (≤30 concedidos) y ≥3 rechazos', ok200 >= 25 && ok200 <= 30 && ok429 >= 3, `concedidos=${ok200} rechazados=${ok429}`)
  record('rate-limit · la cola de la ráfaga queda rechazada (429 al final)', codigos[codigos.length - 1] === 429, `último=${codigos[codigos.length - 1]}`)
}

// ═════════════════════════════════════════════════════════════
// Servidor standalone sobre main actual
// ═════════════════════════════════════════════════════════════

async function main() {
  rmSync(DB_PATH, { force: true })
  rmSync(`${DB_PATH}-journal`, { force: true })
  const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
    stdio: 'pipe',
    encoding: 'utf8',
  })
  record('servidor · prisma db push (BD dedicada)', push.status === 0, push.status === 0 ? DB_PATH : push.stderr.slice(-300))

  console.log('construyendo standalone sobre main actual…')
  const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  record('servidor · build de producción (main actual)', built.status === 0)
  if (built.status === 0) {
    cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
    cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
  }

  const server = spawn('bun', [resolve(ROOT, '.next/standalone/server.js')], {
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
  record('servidor · standalone responde', up, up ? BASE : `no arrancó en 30s\n${serverLog.slice(-500)}`)

  if (up) {
    await faseA()
    await faseB()
    await faseC()
  }

  // bun no siempre termina con SIGTERM (residuales observados en las
  // sesiones 3 y 4): gracia de 2 s, SIGKILL si sigue vivo y verificación
  // de muerte real por PID (signal 0), sin tocar procesos ajenos.
  const sigueVivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
  server.kill('SIGTERM')
  await sleep(2_000)
  if (server.pid && sigueVivo(server.pid)) {
    try { process.kill(server.pid, 'SIGKILL') } catch { /* ya muerto */ }
    await sleep(500)
  }
  record('servidor · proceso del standalone terminado de verdad', !server.pid || !sigueVivo(server.pid), `pid=${server.pid ?? '—'}`)
}

await main()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
