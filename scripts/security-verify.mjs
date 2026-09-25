// Verificación end-to-end de los fixes de seguridad de la Ronda 11 de bugs
// sobre el servidor standalone de producción (mismo arranque que el canon).
//
//   1. Cabeceras de seguridad en / y /api/state
//   2. Cookie malformada → 401 (antes: 500 por URIError)
//   3. Rate limit compartido de mutaciones admin → 429 al agotar 30/min
//   4. Tope de tamaño en POST /api/settings → 413
//   5. Guard SSRF: literales IPv6 con corchetes → 403 (antes: bypass 'public')
//
// Uso: bun scripts/security-verify.mjs   (requiere .next/standalone ya construido)
import { spawn } from 'node:child_process'
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
