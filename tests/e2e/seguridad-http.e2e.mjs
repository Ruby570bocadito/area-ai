#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-seguridad-http — agente TEST (protocolo v2)
//
//   bun tests/e2e/seguridad-http.e2e.mjs
//
// Superficie HTTP de seguridad contra instancia local con BD
// dedicada (no toca db/custom.db). Dos fases:
//
//   FASE A — modo local abierto (sin ADMIN_TOKEN, decisión R4):
//     · CSRF: Origin: null, cross-host y text/plain cross-site → 403;
//       sin Origin (curl) y Origin same-host → admitidos.
//     · Topes de cuerpo: Content-Length > tope → 413; chunked > tope
//       → 413 (verificación de cierre de H-001); chunked pequeño → 200
//       (modo abierto R4, mismo comportamiento sin chunked).
//     · Login en modo abierto → 400; JSON inválido en /api/auth → 400.
//     · SSRF: baseUrl de metadata de nube (IP IMDS y host GCP) → 403.
//     · Rate limit de campañas: 6/min → la 7ª petición 429; los GET
//       no se limitan; la campaña en curso no se corrompe.
//
//   FASE B — con ADMIN_TOKEN (segunda instancia, buckets frescos):
//     · Mutaciones sin credencial → 401 (incluye chunked sin credencial,
//       caso H-001/caso 11 de security-verify) y token erróneo → 401.
//     · GETs de datos siguen abiertos por diseño.
//     · Login erróneo → 401; login correcto → 200 + cookie HttpOnly/
//       SameSite=Strict/Path=/Max-Age 12 h (sin Secure en http);
//       la cookie acredita la mutación; logout expira; cross-origin
//       rechaza aunque el token sea válido.
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-seguridad.db`
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'e2e-token-seguridad-2026'
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

// ── clientes HTTP ────────────────────────────────────────────
async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
  })
  const text = await res.text().catch(() => '')
  return { status: res.status, headers: res.headers, body: text, json: safeJson(text) }
}

function safeJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

// chunked real: node:http con escritura en trozos y sin Content-Length
// aplica Transfer-Encoding: chunked (técnica de scripts/security-verify.mjs)
function chunkedPost(path, headers, chunks) {
  return new Promise((resolveP) => {
    const req = httpRequest(
      { host: '127.0.0.1', port: PORT, path, method: 'POST', headers },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolveP({ status: res.statusCode, body: data, te: res.headers['transfer-encoding'] }))
      }
    )
    req.on('error', (e) => resolveP({ status: 0, body: String(e) }))
    for (const c of chunks) req.write(c)
    req.end()
  })
}

const HOST_HEADER = { host: `127.0.0.1:${PORT}` }

// ── BD dedicada + standalone ─────────────────────────────────
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

function startServer(extraEnv = {}) {
  return spawn('bun', [serverJs], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${DB_PATH}`,
      PORT: String(PORT),
      LAB_PORT: String(LAB_PORT),
      NODE_ENV: 'production',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function waitUp(log) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const ok = await fetch(`${BASE}/api`).then((r) => r.ok).catch(() => false)
    if (ok) return true
  }
  console.log(log.slice(-600))
  return false
}

function stopServer(server, log) {
  return new Promise((resolveP) => {
    server.once('exit', () => resolveP())
    server.kill('SIGTERM')
    setTimeout(() => resolveP(), 5000) // techo por si no muere
    void log
  })
}

// ═════════════════════════════════════════════════════════════
// FASE A — modo local abierto (sin ADMIN_TOKEN)
// ═════════════════════════════════════════════════════════════
let server = startServer()
let serverLog = ''
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))

const upA = await waitUp(serverLog)
record('FASE A · servidor standalone responde (sin ADMIN_TOKEN)', upA, upA ? BASE : 'no arrancó en 30s')

if (upA) {
  // ── CSRF (hallazgo Ronda 12: bypass text/plain sin preflight) ──
  const csrfCampaign = await post('/api/campaigns', { scenarioId: 'injection' }, { origin: 'http://evil.example' })
  record('campaigns con Origin cross-host → 403', csrfCampaign.status === 403, `${csrfCampaign.status} ${csrfCampaign.json?.error ?? ''}`)

  const csrfNull = await post('/api/campaigns', { scenarioId: 'injection' }, { origin: 'null' })
  record('campaigns con Origin: null (sandbox) → 403', csrfNull.status === 403, `${csrfNull.status} ${csrfNull.json?.error ?? ''}`)

  const csrfTextPlain = await fetch(`${BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', origin: 'http://evil.example' },
    body: JSON.stringify({ scenarioId: 'injection' }),
  })
  record('campaigns text/plain cross-site (bypass histórico) → 403', csrfTextPlain.status === 403, `status=${csrfTextPlain.status}`)

  const csrfAutopilot = await post('/api/autopilot', { enabled: false }, { origin: 'http://evil.example:8080' })
  record('autopilot con Origin cross-host → 403', csrfAutopilot.status === 403, `${csrfAutopilot.status}`)

  const csrfAuth = await post('/api/auth', { token: 'x' }, { origin: 'http://evil.example' })
  record('auth (login) con Origin cross-host → 403', csrfAuth.status === 403, `${csrfAuth.status}`)

  const noOrigin = await post('/api/autopilot', { enabled: false })
  record('autopilot sin Origin (curl/server-to-server) → admitido', noOrigin.status === 200 && noOrigin.json?.ok === true, `${noOrigin.status} ${noOrigin.body.slice(0, 60)}`)

  const sameOrigin = await post('/api/autopilot', { enabled: false }, { origin: `http://127.0.0.1:${PORT}` })
  record('autopilot con Origin same-host:puerto → admitido', sameOrigin.status === 200 && sameOrigin.json?.ok === true, `${sameOrigin.status} ${sameOrigin.body.slice(0, 60)}`)

  // ── topes de cuerpo ────────────────────────────────────────
  const fatAutopilot = await post('/api/autopilot', { enabled: false, junk: 'x'.repeat(2048) })
  record('autopilot Content-Length 2KB (tope 1KB) → 413', fatAutopilot.status === 413, `${fatAutopilot.status} ${fatAutopilot.json?.error ?? ''}`)

  const fatCampaigns = await post('/api/campaigns', { scenarioId: 'x'.repeat(5000) })
  record('campaigns Content-Length 5KB (tope 4KB) → 413', fatCampaigns.status === 413, `${fatCampaigns.status} ${fatCampaigns.json?.error ?? ''}`)

  // En /api/auth el cortocircuito de modo abierto corre ANTES de leer el
  // cuerpo (readJsonBody): contesta 400 sin consumir el stream (sin lectura
  // sin acotar). El 413 del tope de 1 KB solo es alcanzable con ADMIN_TOKEN
  // → se verifica en la FASE B.
  const fatAuthOpen = await post('/api/auth', { token: 'x'.repeat(2000) })
  record('auth 2KB en modo abierto → 400 (cortocircuito antes de leer el cuerpo)', fatAuthOpen.status === 400, `${fatAuthOpen.status} ${fatAuthOpen.json?.error ?? ''}`)

  const badAuth = await post('/api/auth', '{token: no-soy-json')
  record('auth JSON inválido → 400 (sin 500)', badAuth.status === 400, `${badAuth.status} ${badAuth.json?.error ?? ''}`)

  // ── H-001 · punto 1: chunked > tope → 413 (readJsonBody acota el stream) ──
  const chunkedFat = await chunkedPost('/api/autopilot', {
    ...HOST_HEADER,
    'content-type': 'application/json',
  }, ['{"enabled":true,"junk":"', 'x'.repeat(4096), 'x'.repeat(4096), '"}'])
  record('H-001 · autopilot chunked 8KB sin Content-Length → 413 (tope de stream)', chunkedFat.status === 413, `status=${chunkedFat.status} te=${chunkedFat.te}`)

  // ── H-001 · punto 2: chunked pequeño en modo abierto → 200 (R4, sin bypass) ──
  const chunkedSmall = await chunkedPost('/api/autopilot', {
    ...HOST_HEADER,
    'content-type': 'application/json',
  }, ['{"enabled":', 'false}'])
  record('H-001 · autopilot chunked pequeño (16B) en modo abierto → 200 (mismo R4 que sin chunked)', chunkedSmall.status === 200, `status=${chunkedSmall.status} te=${chunkedSmall.te}`)

  // ── login en modo abierto ─────────────────────────────────
  const openAuth = await post('/api/auth', { token: TOKEN })
  record('login sin ADMIN_TOKEN configurado → 400 (nada que acreditar)', openAuth.status === 400, `${openAuth.status} ${openAuth.json?.error ?? ''}`)

  // ── SSRF: el servidor no es proxy hacia metadata de nube ──
  const ssrfImds = await post('/api/models', { baseUrl: 'http://169.254.169.254/latest/meta-data/', apiKey: 'sk-e2e-probe' })
  record('SSRF · baseUrl IMDS 169.254.169.254 → 403 metadata', ssrfImds.status === 403, `${ssrfImds.status} ${ssrfImds.json?.error ?? ''}`)

  const ssrfGcp = await post('/api/models', { baseUrl: 'http://metadata.google.internal/computeMetadata/v1/', apiKey: 'sk-e2e-probe' })
  record('SSRF · baseUrl metadata.google.internal → 403 metadata', ssrfGcp.status === 403, `${ssrfGcp.status} ${ssrfGcp.json?.error ?? ''}`)

  // ── rate limit de campañas (6/min) ─────────────────────────
  const first = await post('/api/campaigns', {})
  const campaignId = first.json?.campaignId
  record('rate-limit · POST 1 lanza campaña (200)', first.status === 200 && !!campaignId, `${first.status} campaña ${campaignId ?? '—'}`)

  const rapid = await Promise.all([
    post('/api/campaigns', {}),
    post('/api/campaigns', {}),
    post('/api/campaigns', {}),
    post('/api/campaigns', {}),
    post('/api/campaigns', {}),
  ])
  const all409 = rapid.every((r) => r.status === 409)
  record('rate-limit · POST 2-6 rápidos con campaña en curso → 409 (y consumen ventana)', all409, rapid.map((r) => r.status).join('/'))

  const sixth = await post('/api/campaigns', {})
  const limited = await post('/api/campaigns', {})
  record('rate-limit · la 7ª petición de la ventana → 429', sixth.status === 429 || limited.status === 429, `status=${sixth.status}/${limited.status} ${limited.json?.error ?? ''}`)

  const getState = await fetch(`${BASE}/api/campaigns`)
  record('rate-limit · GET de datos no se limita → 200', getState.status === 200, `status=${getState.status}`)

  if (campaignId) {
    const deadline = Date.now() + 180_000
    let finalStatus = 'RUNNING'
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await fetch(`${BASE}/api/campaigns/${campaignId}`).then((r) => r.json()).catch(() => null)
      if (res?.ok && res.campaign?.status !== 'RUNNING') { finalStatus = res.campaign.status; break }
    }
    record('rate-limit · la campaña lanzada antes del 429 termina bien (no se corrompe)', finalStatus === 'COMPLETED', `estado final=${finalStatus}`)
  }
}

await stopServer(server, serverLog)
await new Promise((r) => setTimeout(r, 1000)) // dejar morir el puerto

// ═════════════════════════════════════════════════════════════
// FASE B — con ADMIN_TOKEN (segunda instancia, buckets frescos)
// ═════════════════════════════════════════════════════════════
server = startServer({ ADMIN_TOKEN: TOKEN })
serverLog = ''
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))

const upB = await waitUp(serverLog)
record('FASE B · servidor standalone responde (con ADMIN_TOKEN)', upB, upB ? BASE : 'no arrancó en 30s')

if (upB) {
  const noCred = await post('/api/campaigns', {})
  record('campaigns sin credencial → 401', noCred.status === 401, `${noCred.status} ${noCred.json?.error ?? ''}`)

  // ── H-001 · punto 3: chunked sin credencial NO sortea la acreditación ──
  const chunkedNoCred = await chunkedPost('/api/autopilot', {
    ...HOST_HEADER,
    'content-type': 'application/json',
  }, ['{"enabled":', 'true}'])
  record('H-001 · autopilot chunked sin credencial con ADMIN_TOKEN → 401 (no sortea la barrera)', chunkedNoCred.status === 401, `status=${chunkedNoCred.status} te=${chunkedNoCred.te}`)

  const badToken = await post('/api/autopilot', { enabled: false }, { 'x-admin-token': 'token-falso' })
  record('autopilot con token erróneo → 401', badToken.status === 401, `${badToken.status}`)

  const openGet = await fetch(`${BASE}/api/state`)
  record('GET /api/state sigue abierto por diseño → 200', openGet.status === 200, `status=${openGet.status}`)

  const fatAuth = await post('/api/auth', { token: 'x'.repeat(2000) })
  record('auth Content-Length 2KB (tope 1KB) con ADMIN_TOKEN → 413', fatAuth.status === 413, `${fatAuth.status} ${fatAuth.json?.error ?? ''}`)

  const loginBad = await post('/api/auth', { token: 'no-es-el-token' })
  record('login con token erróneo → 401 (mensaje sin oráculo)', loginBad.status === 401, `${loginBad.status} ${loginBad.json?.error ?? ''}`)

  const loginOk = await post('/api/auth', { token: TOKEN })
  const setCookie = loginOk.headers.getSetCookie?.()[0] ?? loginOk.headers.get('set-cookie') ?? ''
  const cookieOk =
    loginOk.status === 200 &&
    setCookie.includes('admin_token=') &&
    /httponly/i.test(setCookie) &&
    /samesite=strict/i.test(setCookie) &&
    /path=\//i.test(setCookie) &&
    /max-age=43200/i.test(setCookie) &&
    !/secure/i.test(setCookie)
  record('login correcto → 200 + cookie HttpOnly/SameSite=Strict/Path=/12h (sin Secure en http)', cookieOk, `${loginOk.status} · ${setCookie.slice(0, 90)}`)

  const cookieValue = setCookie.split(';')[0] ?? ''
  const viaCookie = await post('/api/autopilot', { enabled: false }, { cookie: cookieValue })
  record('mutación acreditada SOLO con la cookie de login → 200', viaCookie.status === 200 && viaCookie.json?.ok === true, `${viaCookie.status} ${viaCookie.body.slice(0, 50)}`)

  const logout = await fetch(`${BASE}/api/auth`, { method: 'DELETE', headers: { cookie: cookieValue } })
  const logoutCookie = logout.headers.getSetCookie?.()[0] ?? logout.headers.get('set-cookie') ?? ''
  record('logout DELETE → 200 + cookie expirada (Max-Age=0)', logout.status === 200 && /max-age=0/i.test(logoutCookie), `${logout.status} · ${logoutCookie.slice(0, 70)}`)

  const afterLogout = await post('/api/autopilot', { enabled: false }, { cookie: 'admin_token=' })
  record('mutación con cookie vacía tras logout → 401', afterLogout.status === 401, `${afterLogout.status}`)

  const csrfWithToken = await post('/api/auth', { token: TOKEN }, { origin: 'http://evil.example' })
  record('login cross-origin rechazado AUNQUE el token sea válido → 403 (CSRF primera barrera)', csrfWithToken.status === 403, `${csrfWithToken.status}`)
}

await stopServer(server, serverLog)

// ── resumen ──────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
