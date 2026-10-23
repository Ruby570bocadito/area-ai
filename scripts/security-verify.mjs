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
//
// Uso: bun scripts/security-verify.mjs   (requiere .next/standalone ya construido)
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const PORT = 3105
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

// 1 ── Cabeceras de seguridad
for (const path of ['/', '/api/state']) {
  const res = await fetch(`${BASE}${path}`)
  const xcto = res.headers.get('x-content-type-options')
  const xfo = res.headers.get('x-frame-options')
  const rp = res.headers.get('referrer-policy')
  const pp = res.headers.get('permissions-policy')
  check(`cabeceras en ${path}`, xcto === 'nosniff' && xfo === 'SAMEORIGIN' && rp === 'strict-origin-when-cross-origin' && Boolean(pp),
    `nosniff=${xcto} xfo=${xfo} rp=${rp} pp=${pp ? 'sí' : 'no'}`)
}

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

server.kill()
await new Promise((r) => setTimeout(r, 300))

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

const login = await rawPost('/api/auth', {
  host: '127.0.0.1:' + PORT,
  'content-type': 'application/json',
}, JSON.stringify({ token: TOKEN }))
const setCookie = Array.isArray(login.headers?.['set-cookie']) ? login.headers['set-cookie'][0] : (login.headers?.['set-cookie'] ?? '')
check('login correcto → 200 + cookie HttpOnly SameSite=Strict Path=/',
  login.status === 200 && setCookie.includes('admin_token=') && setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Strict') && setCookie.includes('Path=/'),
  `status=${login.status} cookie=${setCookie.split(';').slice(0, 4).join(';')}`)
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

server2.kill()
await new Promise((r) => setTimeout(r, 200))

console.log(failures === 0 ? '\nVERDE: verificación de seguridad completa OK' : `\nROJO: ${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
