// Verificación end-to-end de los fixes de seguridad de las rondas 11-12 de bugs
// sobre el servidor standalone de producción (mismo arranque que el canon).
//
//   1. Cabeceras de seguridad en / y /api/state
//   2. Cookie malformada → 401 (antes: 500 por URIError)
//   3. Rate limit compartido de mutaciones admin → 429 al agotar 30/min
//   4. Tope de tamaño en POST /api/settings → 413
//   5. Guard SSRF: literales IPv6 con corchetes → 403 (antes: bypass 'public')
//   6. CSRF/same-origin (Ronda 12): POST cross-site con Origin ajeno → 403 en
//      las 4 mutaciones; Origin: null → 403; same-origin y sin Origin pasan.
//   7. Coerción estricta del autopiloto (Ronda 12): enabled:"false" NO activa.
//   8. Tope de cuerpo pre-parse (Ronda 12): Content-Length > 1KB en autopilot → 413.
//   9. Tope de cuerpo CHUNKED (tarea cuerpo-chunked del ROADMAP): 8KB chunked sin
//      Content-Length en autopilot → 413; chunked pequeño → 200 (legítimo intacto).
//  10. Login /api/auth (tarea cookie-admin-httponly del ROADMAP): token correcto
//      fija cookie HttpOnly/SameSite=Strict; token erróneo → 401; cross-origin → 403;
//      la cookie acreditada sirve para mutar (UI sin cabeceras); logout DELETE expira.
//  11. H-001 (hallazgo TEST): Transfer-Encoding: chunked NO sortea ni el tope de
//      stream (caso 9) ni la acreditación: sin credencial con ADMIN_TOKEN → 401.
//  12. caddy-hardening (ROADMAP): sin X-Powered-By (huella de versión de Next).
//  13. traversal-codificado-verify (ROADMAP, petición de IMP-1): la variante
//      codificada `..%2f` es la que REALMENTE llega al clasificador del lab (el
//      cliente WHATWG colapsa los `..` literales antes de enviar); cadena
//      completa contra el laboratorio REAL con BD desechable y motor SIM.
//  14. casos-nuevos (ROADMAP): fuerza bruta de token DIRECTA contra
//      /api/campaigns — petición de DIR tras ratificar endurecimiento-hd (la
//      original golpea /api/settings): el bucket `admin:` se agota ANTES de la
//      comparación del token (401×30 → 429, sin oráculo de fuerza bruta).
//  15. casos-nuevos (ROADMAP): errores-sin-fuga — las respuestas de error
//      (404/400) llevan mensajes genéricos sin trazas, rutas ni dependencias
//      internas.
//
// Uso: bun scripts/security-verify.mjs   (requiere .next/standalone ya construido)
// Puerto: SECURITY_VERIFY_PORT (defecto 3105; tarea security-verify-puerto del
// ROADMAP, acordada con PUL) — cada agente puede pasar su puerto de la sección 6
// del protocolo (p. ej. SECURITY_VERIFY_PORT=3113 para SEG) sin pisar a nadie.
import { spawn, spawnSync } from 'node:child_process'
import { request as httpRequest, Agent } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const parsedPort = Number(process.env.SECURITY_VERIFY_PORT)
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3105
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'token-verificacion-ronda-11'

const server = spawn('bun', [resolve(ROOT, '.next/standalone/server.js')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', ADMIN_TOKEN: TOKEN },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))

let up = false
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500))
  up = await fetch(`${BASE}/api`).then((r) => r.ok).catch(() => false)
}
if (!up) {
  console.error('NO ARRANCÓ:\n' + log.slice(-800))
  process.exit(1)
}
console.log('servidor arriba en', BASE)

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${extra ? ' · ' + extra : ''}`)
  if (!ok) failures++
}

// Espera a que el proceso del servidor SALGA de verdad (no un sleep fijo):
// una instancia rezagada retendría el puerto y contaminaría los buckets de
// rate limit en memoria de la ejecución siguiente (falsos ROJO intermitentes).
const stopServer = (p) =>
  new Promise((resolveP) => {
    if (p.exitCode !== null || p.signalCode) return resolveP()
    p.once('exit', () => resolveP())
    p.kill()
    setTimeout(resolveP, 3000) // cinturón: no colgarse si el exit no llega
  })

console.log('puerto de verificación:', PORT, PORT === 3105 ? '(defecto)' : '(SECURITY_VERIFY_PORT)')

// 1 ── Cabeceras de seguridad (tarea cabeceras-extra: COOP/CORP en todas las
//      respuestas y Cache-Control: no-store en la API de datos)
for (const path of ['/', '/api/state']) {
  const res = await fetch(`${BASE}${path}`)
  const xcto = res.headers.get('x-content-type-options')
  const xfo = res.headers.get('x-frame-options')
  const rp = res.headers.get('referrer-policy')
  const pp = res.headers.get('permissions-policy')
  const coop = res.headers.get('cross-origin-opener-policy')
  const corp = res.headers.get('cross-origin-resource-policy')
  const xpb = res.headers.get('x-powered-by')
  check(`cabeceras en ${path}`, xcto === 'nosniff' && xfo === 'SAMEORIGIN' && rp === 'strict-origin-when-cross-origin' && Boolean(pp)
    && coop === 'same-origin' && corp === 'same-origin' && xpb === null,
    `nosniff=${xcto} xfo=${xfo} rp=${rp} pp=${pp ? 'sí' : 'no'} coop=${coop} corp=${corp} x-powered-by=${xpb ?? 'ausente'}`)
}
const apiCache = await fetch(`${BASE}/api/state`)
check('Cache-Control: no-store en /api/state (datos vivos sin caché)',
  /no-store/.test(apiCache.headers.get('cache-control') ?? ''), `cache-control=${apiCache.headers.get('cache-control')}`)

const authHeaders = (extra = {}) => ({ 'x-admin-token': TOKEN, ...extra })

// POST/DELETE crudo con node:http — control exacto de cabeceras (Origin es
// "forbidden header name" en la spec fetch y algunos runtimes la silencian).
// Devuelve también las cabeceras de respuesta (set-cookie del login).
const rawPost = (path, headers, body, method = 'POST') =>
  new Promise((resolveP) => {
    const req = httpRequest(
      { host: '127.0.0.1', port: PORT, path, method, headers },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolveP({ status: res.statusCode, body: data, headers: res.headers }))
      }
    )
    req.on('error', (e) => resolveP({ status: 0, body: String(e) }))
    req.end(body)
  })

// 2 ── Cookie malformada → 401, no 500
const badCookie = await fetch(`${BASE}/api/settings`, {
  method: 'POST',
  headers: { cookie: 'admin_token=%' },
  body: JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm' }),
})
check('cookie malformada (%) → 401 (no 500)', badCookie.status === 401, `status=${badCookie.status}`)

const badCookie2 = await fetch(`${BASE}/api/settings`, {
  method: 'POST',
  headers: { cookie: `admin_token=%zz${TOKEN}` },
  body: JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm' }),
})
check('cookie con escape inválido → 401 (no 500)', badCookie2.status === 401, `status=${badCookie2.status}`)

// 3 ── Rate limit compartido del bucket admin (30/min): 31 intentos sin token válido
let saw429 = false
let statuses = []
for (let i = 0; i < 31; i++) {
  const r = await fetch(`${BASE}/api/settings`, {
    method: 'POST',
    headers: { 'x-admin-token': 'token-erróneo-' + i },
    body: JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm' }),
  })
  statuses.push(r.status)
  if (r.status === 429) saw429 = true
}
check('fuerza bruta de token: aparece 429 dentro de la ventana', saw429,
  `últimos status: ${statuses.slice(-4).join(',')}`)

// tras el 429, incluso con token CORRECTO sigue 429 (misma ventana/bucket)
const limitedEvenWithToken = await fetch(`${BASE}/api/settings`, {
  method: 'POST',
  headers: authHeaders(),
  body: JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm' }),
})
check('429 se impone incluso con token válido (mismo bucket)', limitedEvenWithToken.status === 429,
  `status=${limitedEvenWithToken.status}`)

await stopServer(server)

// ── Segundo arranque: sin exhaustar el bucket, para validar 413 y el guard
const server2 = spawn('bun', [resolve(ROOT, '.next/standalone/server.js')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', ADMIN_TOKEN: TOKEN },
  stdio: ['ignore', 'pipe', 'pipe'],
})
up = false
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500))
  up = await fetch(`${BASE}/api`).then((r) => r.ok).catch(() => false)
}
if (!up) { console.error('NO ARRANCÓ (2):\n' + log.slice(-400)); process.exit(1) }

// 6 ── CSRF/same-origin (Ronda 12): Origin ajeno → 403 ANTES de 401/429/413
// (llevamos token válido: si respondiera 401, el check de origen no sería el primero)
const csrfTargets = ['/api/campaigns', '/api/autopilot', '/api/settings', '/api/models']
for (const t of csrfTargets) {
  const r = await rawPost(t, {
    origin: 'http://evil.example',
    host: '127.0.0.1:' + PORT,
    'content-type': 'text/plain', // POST simple sin preflight — el vector clásico
    'x-admin-token': TOKEN,
  }, JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm', enabled: true }))
  check(`CSRF cross-origin ${t} → 403`, r.status === 403, `status=${r.status}`)
}

// Origin: null (iframe arenero) → 403
const nullOrigin = await rawPost('/api/settings', {
  origin: 'null',
  host: '127.0.0.1:' + PORT,
  'content-type': 'text/plain',
  'x-admin-token': TOKEN,
}, JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm' }))
check('CSRF Origin: null → 403', nullOrigin.status === 403, `status=${nullOrigin.status}`)

// same-origin (Origin === Host) con token válido → llega al handler (UI intacta)
const sameOrigin = await rawPost('/api/autopilot', {
  origin: 'http://127.0.0.1:' + PORT,
  host: '127.0.0.1:' + PORT,
  'content-type': 'text/plain',
  'x-admin-token': TOKEN,
}, JSON.stringify({ enabled: false }))
check('POST same-origin con token → 200 (UI intacta)', sameOrigin.status === 200 && /"enabled":false/.test(sameOrigin.body),
  `status=${sameOrigin.status}`)

// sin Origin (curl / humo / verificación) con token válido → llega al handler
const noOrigin = await rawPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  'x-admin-token': TOKEN,
}, JSON.stringify({ enabled: false }))
check('POST sin Origin (curl/humo) → 200', noOrigin.status === 200, `status=${noOrigin.status}`)

// 7 ── Coerción estricta del autopiloto (Ronda 12): la cadena "false" NO activa
const stringFalse = await rawPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  'x-admin-token': TOKEN,
}, JSON.stringify({ enabled: 'false' }))
check('enabled:"false" (cadena) NO activa el modo continuo', stringFalse.status === 200 && /"enabled":false/.test(stringFalse.body),
  `status=${stringFalse.status}`)

// 8 ── Tope de cuerpo pre-parse (Ronda 12): Content-Length > 1KB en autopilot → 413
const fatBody = await rawPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  'x-admin-token': TOKEN,
}, JSON.stringify({ enabled: false, junk: 'x'.repeat(3000) }))
check('cuerpo > 1KB en autopilot → 413 pre-parse', fatBody.status === 413, `status=${fatBody.status}`)

// 9 ── Tope de cuerpo CHUNKED (tarea cuerpo-chunked del ROADMAP): sin
// Content-Length (node:http aplica Transfer-Encoding: chunked al escribir
// trozos), 8 KB en autopilot (tope 1 KB) → 413 al consumir el stream con tope.
const chunkedPost = (path, headers, chunks) =>
  new Promise((resolveP) => {
    // Agente de un solo uso: el cuerpo chunked puede quedar SIN leer en el
    // servidor (p. ej. 401 antes de readJsonBody) y el globalAgent podría
    // reutilizar ese socket para la petición siguiente — bytes residuales del
    // cuerpo y respuesta 400 vacía intermitente del parser. Socket dedicado y
    // cerrado = secuencia determinista (diagnóstico del ROJO del 2026-10-23).
    const agent = new Agent({ keepAlive: false })
    const req = httpRequest(
      { host: '127.0.0.1', port: PORT, path, method: 'POST', headers, agent },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          agent.destroy()
          resolveP({ status: res.statusCode, body: data, te: res.headers['transfer-encoding'] })
        })
      }
    )
    req.on('error', (e) => {
      agent.destroy()
      resolveP({ status: 0, body: String(e) })
    })
    for (const c of chunks) req.write(c)
    req.end()
  })
const chunkedFat = await chunkedPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  'x-admin-token': TOKEN,
}, ['{"enabled":false,"junk":"', 'x'.repeat(4096), 'x'.repeat(4096), '"}'])
check('cuerpo chunked 8KB sin Content-Length en autopilot → 413 (tope de stream)',
  chunkedFat.status === 413, `status=${chunkedFat.status} te=${chunkedFat.te}`)
const chunkedOk = await chunkedPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  'x-admin-token': TOKEN,
}, ['{"enabled":', 'false}'])
check('cuerpo chunked pequeño → 200 (cliente legítimo intacto)',
  chunkedOk.status === 200 && /"enabled":false/.test(chunkedOk.body), `status=${chunkedOk.status}`)

// 10 ── Login /api/auth (tarea cookie-admin-httponly): sustituye a la
// recomendación de document.cookie — el servidor fija la cookie con
// HttpOnly/SameSite=Strict y JavaScript no maneja el token.
const authCsrf = await rawPost('/api/auth', {
  origin: 'http://evil.example',
  host: '127.0.0.1:' + PORT,
  'content-type': 'text/plain',
}, JSON.stringify({ token: TOKEN }))
check('CSRF cross-origin /api/auth → 403 (misma barrera que las mutaciones)', authCsrf.status === 403, `status=${authCsrf.status}`)

const badLogin = await rawPost('/api/auth', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
}, JSON.stringify({ token: 'token-erróneo' }))
check('login con token erróneo → 401 (sin oráculo de existencia)', badLogin.status === 401, `status=${badLogin.status}`)

// 11 ── H-001 (hallazgo TEST): el cuerpo chunked pequeño queda por debajo del
//      tope (legítimo) pero NO sortea la acreditación: con ADMIN_TOKEN activo,
//      sin cabecera ni cookie → 401. El 200 del modo local abierto (sin
//      ADMIN_TOKEN) es la decisión R4, idéntica para chunked y no-chunked.
const chunkedNoCreds = await chunkedPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
}, ['{"enabled":', 'true}'])
check('chunked sin credencial (ADMIN_TOKEN activo) → 401 (no sortea la barrera)',
  chunkedNoCreds.status === 401, `status=${chunkedNoCreds.status}`)

const login = await rawPost('/api/auth', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
}, JSON.stringify({ token: TOKEN }))
const setCookie = Array.isArray(login.headers?.['set-cookie']) ? login.headers['set-cookie'][0] : (login.headers?.['set-cookie'] ?? '')
check('login correcto → 200 + cookie HttpOnly SameSite=Strict Path=/',
  login.status === 200 && setCookie.includes('admin_token=') && setCookie.includes('HttpOnly') && /samesite=strict/i.test(setCookie) && setCookie.includes('Path=/'),
  `status=${login.status} cookie=${setCookie.split(';').slice(0, 6).join(';')} cuerpo=${login.body.slice(0, 80)}`)
check('cookie local (http) sin Secure — Secure solo en https', !setCookie.includes('Secure'), setCookie.includes('Secure') ? 'contiene Secure (no esperado en http)' : 'sin Secure')

// La cookie fijada por el servidor acredita mutaciones sin cabeceras (camino de la UI)
const cookiePair = (setCookie.split(';')[0] || '').trim()
const mutateWithCookie = await rawPost('/api/autopilot', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  cookie: cookiePair,
}, JSON.stringify({ enabled: false }))
check('mutación con cookie del login → 200 (UI sin tocar document.cookie)',
  mutateWithCookie.status === 200 && /"enabled":false/.test(mutateWithCookie.body), `status=${mutateWithCookie.status}`)

const logout = await rawPost('/api/auth', {
  host: '127.0.0.1:' + PORT,
}, undefined, 'DELETE')
const logoutCookie = Array.isArray(logout.headers?.['set-cookie']) ? logout.headers['set-cookie'][0] : (logout.headers?.['set-cookie'] ?? '')
check('logout DELETE → 200 y cookie expirada (Max-Age=0)',
  logout.status === 200 && (logoutCookie.includes('Max-Age=0') || /Expires=Thu, 01 Jan 1970/.test(logoutCookie)), `status=${logout.status}`)

// 4 ── Tope de tamaño → 413
const huge = 'x'.repeat(3000)
const tooBig = await fetch(`${BASE}/api/settings`, {
  method: 'POST',
  headers: authHeaders(),
  body: JSON.stringify({ baseUrl: `https://api.example.com/${huge}`, model: 'm' }),
})
check('baseUrl de 3000+ chars → 413', tooBig.status === 413, `status=${tooBig.status}`)

// valores razonables siguen funcionando (y el guard https remoto permite https público)
const okSave = await fetch(`${BASE}/api/settings`, {
  method: 'POST',
  headers: authHeaders(),
  body: JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' }),
})
const okJson = await okSave.json().catch(() => ({}))
check('config válida → 200 ok', okSave.status === 200 && okJson.ok === true, `status=${okSave.status}`)

// 5 ── Guard SSRF: corchetes IPv6 (conexión "remota" vía XFF público)
const remote = { 'x-forwarded-for': '203.0.113.7' }
const cases = [
  ['https://[::1]:9/v1', 403, 'private'],
  ['https://[fc00::1]:9/v1', 403, 'private'],
  ['https://[::ffff:a9fe:a9fe]/v1', 403, 'metadata'],
  ['https://[2001:4860:4860::8888]/v1', null, 'public (pasa el guard)'],
]
for (const [url, expected, kind] of cases) {
  const r = await fetch(`${BASE}/api/settings`, {
    method: 'POST',
    headers: authHeaders(remote),
    body: JSON.stringify({ baseUrl: url, model: 'm' }),
  })
  const ok = expected === null ? r.status === 200 || r.status === 400 : r.status === expected
  check(`guard remoto ${url} → ${expected ?? 'no-bloqueado'} (${kind})`, ok, `status=${r.status}`)
}

await stopServer(server2)

// 13 ── traversal-codificado-verify (ROADMAP, petición de IMP-1): la variante
//      codificada `..%2f` es la que REALMENTE llega al clasificador del lab —
//      el cliente WHATWG colapsa los `..` literales antes de enviar, pero
//      `..%2f`/`%2e%2e%2f` viajan intactos. Cadena completa contra el
//      laboratorio REAL: campaña determinista (SIM, sin claves de proveedor),
//      regla SIEM, ataque traversal codificado a un nodo DMZ y correlación del
//      SIEM. BD desechable: la campaña queda RUNNING al cortar el servidor y
//      no debe tocar la del operador.
const parsedLabPort = Number(process.env.SECURITY_VERIFY_LAB_PORT)
const LAB_PORT = Number.isInteger(parsedLabPort) && parsedLabPort > 0 && parsedLabPort < 65536
  ? parsedLabPort
  : PORT + 1300 // convención de puertos SEG: 3113 → 4413 (§6 del protocolo)
const DB_LAB = resolve(ROOT, '.agent-tmp/security-verify-lab.db')
mkdirSync(resolve(ROOT, '.agent-tmp'), { recursive: true })
rmSync(DB_LAB, { force: true })
rmSync(`${DB_LAB}-journal`, { force: true })
const dbPush = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: `file:${DB_LAB}` },
  stdio: 'pipe',
  encoding: 'utf8',
})
// El sembrado corre FUERA del servidor: /api/state debe traer los escenarios
// ANTES del primer lanzamiento (ensureSeed solo se ejecuta dentro de startCampaign).
const dbSeed = spawnSync('bun', ['-e', `import { ensureSeed } from '${resolve(ROOT, 'src/lib/sim/seed')}'; await ensureSeed(); console.log('seeded')`], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: `file:${DB_LAB}` },
  stdio: 'pipe',
  encoding: 'utf8',
})
if (dbPush.status !== 0 || dbSeed.status !== 0) {
  console.error('BD del caso lab no preparada:', ((dbPush.stderr || '') + (dbSeed.stderr || '')).slice(-300))
  process.exit(1)
}
const labEnv = {
  ...process.env,
  DATABASE_URL: `file:${DB_LAB}`,
  PORT: String(PORT),
  LAB_PORT: String(LAB_PORT),
  NODE_ENV: 'production',
  ADMIN_TOKEN: TOKEN,
  TRUST_PROXY: '1', // casos 14: clientKey respeta X-Forwarded-For (cliente de la ráfaga aislado del resto)
}
delete labEnv.OPENAI_API_KEY // motor determinista (SIM): la verificación no gasta LLM
const server3 = spawn('bun', [resolve(ROOT, '.next/standalone/server.js')], {
  cwd: ROOT,
  env: labEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
})
up = false
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500))
  up = await fetch(`${BASE}/api`).then((r) => r.ok).catch(() => false)
}
if (!up) { console.error('NO ARRANCÓ (3):\n' + log.slice(-400)); process.exit(1) }

// Peticiones crudas directas al LAB (otro puerto; node:http no normaliza el path)
const rawLab = (path, headers = {}, body, method = 'GET') =>
  new Promise((resolveP) => {
    const req = httpRequest(
      { host: '127.0.0.1', port: LAB_PORT, path, method, headers },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolveP({ status: res.statusCode, body: data }))
      }
    )
    req.on('error', (e) => resolveP({ status: 0, body: String(e) }))
    if (body !== undefined) req.write(body)
    req.end()
  })

const state = await fetch(`${BASE}/api/state`).then((r) => r.json()).catch(() => null)
const escenarios = Array.isArray(state?.scenarios) ? state.scenarios : []
const fincorp = escenarios.find((s) => s.key === 'fincorp-bank') ?? escenarios[0]
const launch = await rawPost('/api/campaigns', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
  'x-admin-token': TOKEN,
}, JSON.stringify({ scenarioId: fincorp?.id }))
let cid
try { cid = JSON.parse(launch.body)?.campaignId } catch { /* sin cuerpo JSON */ }
check('campaña determinista lanzada para el caso lab (BD desechable, motor SIM)',
  launch.status === 200 && typeof cid === 'string' && cid.length > 0, `status=${launch.status} escenario=${fincorp?.key ?? '—'}`)

// Cinturón: el lab debe estar ESCUCHando antes de golpearlo. ensureLabServer
// se resuelve antes de que el POST devuelva el campaignId, pero bajo carga un
// arranque lento se diagnostica aquí (una sola comprobación clara) en vez de
// fallar en cascada los cinco chequeos de la cadena lab.
let labUp = false
for (let i = 0; i < 20 && !labUp; i++) {
  labUp = await fetch(`http://127.0.0.1:${LAB_PORT}/lab-health`).then((r) => r.ok).catch(() => false)
  if (!labUp) await new Promise((r) => setTimeout(r, 500))
}
check('laboratorio real a la escucha en su puerto (lab-health)', labUp, `lab_port=${LAB_PORT}`)

if (typeof cid === 'string' && fincorp) {
  const ficha = await fetch(`${BASE}/api/campaigns/${cid}`).then((r) => r.json()).catch(() => null)
  const nodes = Array.isArray(ficha?.infra?.nodes) ? ficha.infra.nodes : []
  const siem = nodes.find((n) => n.type === 'SIEM')
  const dmz = nodes.find((n) => n.segment === 'DMZ' && n.type === 'WEB')
    ?? nodes.find((n) => n.segment === 'DMZ' && n.type !== 'SIEM')
  check('escenario con nodo SIEM y nodo DMZ para la cadena de detección', Boolean(siem && dmz), `nodos=${nodes.length}`)
  if (siem && dmz) {
    const rule = await rawLab(`/lab/${cid}/${siem.id}/rules`, { 'content-type': 'application/json', 'x-lab-operator': 'soc' }, JSON.stringify({ signature: 'PATH_TRAVERSAL', nodeId: dmz.id }), 'POST')
    check('regla SIEM desplegada: PATH_TRAVERSAL en el nodo DMZ', rule.status === 201, `status=${rule.status}`)
    const trav = await rawLab(`/lab/${cid}/${dmz.id}/..%2fetc%2fpasswd`)
    check('traversal codificado ..%2f llega al lab INTACTO → 404 estructurado (no 500)',
      trav.status === 404 && trav.body.includes('..%2fetc%2fpasswd'), `status=${trav.status}`)
    const travDouble = await rawLab(`/lab/${cid}/${dmz.id}/%2e%2e%2fetc%2fpasswd`)
    check('variante %2e%2e%2f (sin puntos literales) también responde estructurado',
      travDouble.status === 404, `status=${travDouble.status}`)
    const ev = await rawLab(`/lab/${cid}/${siem.id}/events?signature=PATH_TRAVERSAL`, { 'x-lab-operator': 'soc' })
    let evJson = null
    try { evJson = JSON.parse(ev.body) } catch { /* sin cuerpo JSON */ }
    const paths = (Array.isArray(evJson?.events) ? evJson.events : []).map((e) => String(e.path))
    check('SIEM correla ..%2f con la firma PATH_TRAVERSAL (la variante que llega al clasificador)',
      ev.status === 200 && paths.some((p) => p.includes('..%2f')), `eventos=${evJson?.count ?? 0}`)
    check('SIEM correla %2e%2e%2f (el clasificador mira también el path decodificado)',
      paths.some((p) => p.includes('%2e%2e')), `paths=${paths.length}`)
  }
} else {
  check('caso lab completo', false, `launch=${launch.status} escenario=${fincorp?.key ?? '—'}`)
}

// 14 ── Fuerza bruta DIRECTA contra /api/campaigns (petición de DIR tras
//      ratificar endurecimiento-hd): el bucket `admin:` compartido debe
//      aplicarse ANTES de comparar el token (la variante original golpeaba
//      /api/settings). Cliente distinto vía X-Forwarded-For (TRUST_PROXY=1 en
//      este arranque) para partir de un bucket fresco: 401×30 → 429.
const bruteCampaigns = []
let saw429Campaigns = false
for (let i = 0; i < 31; i++) {
  const r = await rawPost('/api/campaigns', {
    host: '127.0.0.1:' + PORT,
    'content-type': 'application/json',
    'x-forwarded-for': '198.51.100.77',
    'x-admin-token': 'token-erróneo-' + i,
  }, JSON.stringify({}))
  bruteCampaigns.push(r.status)
  if (r.status === 429) saw429Campaigns = true
}
check('fuerza bruta DIRECTA en /api/campaigns: 429 dentro de la ventana (bucket admin: antes del token)',
  saw429Campaigns && bruteCampaigns.slice(0, 5).every((s) => s === 401),
  `primeros=${bruteCampaigns.slice(0, 3).join(',')} últimos=${bruteCampaigns.slice(-3).join(',')}`)

// 15 ── errores-sin-fuga (hallazgo cerrado del ROADMAP): las respuestas de
//      error llevan mensajes genéricos — sin trazas de pila, rutas de ficheros
//      ni nombres de dependencias internas.
const noStack = /(node_modules|\.next[\\/]|prisma|Error:\s|at\s+\w+\s+\()/
const err404 = await fetch(`${BASE}/api/campaigns/campaña-que-no-existe`)
const err404Body = await err404.text().catch(() => '')
check('404 de campaña inexistente: cuerpo genérico sin trazas internas',
  err404.status === 404 && /"error"/.test(err404Body) && !noStack.test(err404Body),
  `status=${err404.status} cuerpo=${err404Body.slice(0, 60)}`)
const errTraversal = await fetch(`${BASE}/api/campaigns/..%2fetc%2fpasswd`)
const errTraversalBody = await errTraversal.text().catch(() => '')
check('id de campaña con traversal codificado: sin 500 y sin fugas internas',
  (errTraversal.status === 404 || errTraversal.status === 400) && !noStack.test(errTraversalBody),
  `status=${errTraversal.status} cuerpo=${errTraversalBody.slice(0, 60)}`)

await stopServer(server3)

console.log(failures === 0 ? '\nVERDE: verificación de seguridad completa OK' : `\nROJO: ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
