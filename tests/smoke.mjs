#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Test de humo del golden path de area·ai (Ronda 3, Implementaciones;
// Ronda 5 añade fase 0 de unidades y fase 5 opcional de campaña real)
//
//   bun tests/smoke.mjs           → usa el build existente (o construye si falta)
//   bun tests/smoke.mjs --build   → fuerza build de producción antes de arrancar
//   SMOKE_SKIP_TSC=1              → salta el chequeo de tipos (para iterar rápido)
//   SMOKE_SKIP_UNIT=1             → salta los tests unitarios (fase 0)
//   SMOKE_START_CAMPAIGN=1        → lanza UNA campaña real y espera su fin (opt-in:
//                                   escribe en la BD objetivo; hasta ~4 min)
//
// Fases: (0) bun test tests/ — guard SSRF + token/rate limit  (1) tsc --noEmit
// (2) entorno (.env, prisma db push)  (3) servidor de producción standalone
// (4) golden path: /api, /api/state (con seed), /api/campaigns,
// /api/knowledge, página principal.  (5, opt-in) campaña end-to-end.
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const PORT = Number(process.env.SMOKE_PORT || 3101)
const DB_PATH = `${ROOT}/db/custom.db`
const BASE = `http://127.0.0.1:${PORT}`
const FORCE_BUILD = process.argv.includes('--build')
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts })
  return r.status === 0
}

function parseEnvFile() {
  const envPath = resolve(ROOT, '.env')
  if (!existsSync(envPath)) return {}
  const vars = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return vars
}

async function checkJson(path, validate) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
  const body = await res.json().catch(() => null)
  if (!body?.ok) return { ok: false, detail: 'ok:false en la respuesta' }
  if (validate) {
    const problem = validate(body)
    if (problem) return { ok: false, detail: problem }
  }
  return { ok: true, detail: '' }
}

// ── Fase 0: tests unitarios ─────────────────────────────────
if (!process.env.SMOKE_SKIP_UNIT) {
  console.log('── Fase 0: tests unitarios (bun test tests/)')
  record('tests unitarios (guard SSRF + acceso)', run('bun', ['test', 'tests/']))
} else {
  console.log('── Fase 0: omitida (SMOKE_SKIP_UNIT)')
}

// ── Fase 1: tipos ────────────────────────────────────────────
if (!process.env.SMOKE_SKIP_TSC) {
  console.log('── Fase 1: tsc --noEmit')
  record('tsc --noEmit sin errores', run('npx', ['tsc', '--noEmit']))
} else {
  console.log('── Fase 1: omitida (SMOKE_SKIP_TSC)')
}

// ── Fase 2: entorno ──────────────────────────────────────────
console.log('── Fase 2: entorno (.env + prisma)')
if (!existsSync(resolve(ROOT, '.env')) && !process.env.DATABASE_URL) {
  // Solo si no hay ni .env ni variable global: crear .env con ruta ABSOLUTA
  // (las relativas se resuelven de forma distinta entre CLI y runtime)
  copyFileSync(resolve(ROOT, '.env.example'), resolve(ROOT, '.env'))
  const envContent = readFileSync(resolve(ROOT, '.env'), 'utf8')
    .replace(/^DATABASE_URL=.*/m, `DATABASE_URL="file:${ROOT}/db/custom.db"`)
  writeFileSync(resolve(ROOT, '.env'), envContent)
  console.log('.env creado desde .env.example (DATABASE_URL absoluta)')
}

// EL MISMO entorno para la CLI de prisma y para el servidor del golden path:
// las variables de proceso globales tienen prioridad sobre .env en la CLI,
// así que fijamos explícitamente la misma DATABASE_URL en ambos lados.
const envFileVars = parseEnvFile()
let effectiveUrl = envFileVars.DATABASE_URL ?? process.env.DATABASE_URL

// Normalización de rutas relativas (trap R10, caso .env PRESENTE con ruta
// relativa — p. ej. el flujo de desarrollo documentado: file:./dev.db):
// la CLI de Prisma resuelve file: relativo al directorio del esquema (prisma/)
// mientras que el runtime standalone lo hace respecto a su propia raíz, así que
// push y servidor apuntan a BD distintas (P2021). Se normaliza a absoluta
// (semántica del CLI) para ambos lados, sin reescribir el .env del usuario.
if (effectiveUrl?.startsWith('file:')) {
  const rawPath = effectiveUrl.slice('file:'.length)
  if (!isAbsolute(rawPath)) effectiveUrl = `file:${resolve(ROOT, 'prisma', rawPath)}`
}

const childEnv = { ...process.env, ...envFileVars }
if (effectiveUrl?.startsWith('file:')) {
  childEnv.DATABASE_URL = effectiveUrl
  // SQLite NO crea directorios padre: garantizarlos antes del push
  mkdirSync(resolve(effectiveUrl.slice('file:'.length), '..'), { recursive: true })
}
console.log(`BD objetivo: ${effectiveUrl ?? '(sin DATABASE_URL)'}`)

if (!run('bunx', ['prisma', 'db', 'push'], { env: childEnv })) {
  record('prisma db push', false, 'falló la sincronización del esquema')
  finish()
}
const dbFilePath = effectiveUrl?.startsWith('file:') ? effectiveUrl.slice('file:'.length) : null
record(
  'archivo de BD accesible',
  dbFilePath ? existsSync(dbFilePath) && statSync(dbFilePath).size > 0 : true,
  dbFilePath ?? 'no verificable (url no file:)'
)

// ── Fase 3: build + servidor ─────────────────────────────────
console.log('── Fase 3: servidor de producción')
const serverJs = resolve(ROOT, '.next/standalone/server.js')
if (FORCE_BUILD || !existsSync(serverJs)) {
  console.log('construyendo (next build + assets standalone)…')
  const built = run('bun', ['run', 'build'])
  if (!built) {
    record('next build', false)
    finish()
  }
  // next build no copia los assets; replicar el paso del package.json
  cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
  cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
}

const server = spawn('bun', [serverJs], {
  cwd: ROOT,
  // el standalone no siempre carga .env en runtime → inyectarlas explícitamente
  env: { ...childEnv, PORT: String(PORT), NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))

let up = false
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500))
  up = await fetch(`${BASE}/api`)
    .then((r) => r.ok)
    .catch(() => false)
}
record('servidor responde', up, up ? BASE : `no arrancó en 30s\n${serverLog.slice(-800)}`)

// ── Fase 4: golden path ──────────────────────────────────────
if (up) {
  console.log('── Fase 4: golden path')
  record('GET /api (healthcheck + BD)', (await checkJson('/api')).ok)

  const state = await checkJson('/api/state', (b) => {
    if (!Array.isArray(b.agents) || b.agents.length < 10) return `se esperaban ≥10 agentes, hay ${b.agents?.length}`
    if (!Array.isArray(b.scenarios) || b.scenarios.length < 6) return `se esperaban ≥6 escenarios, hay ${b.scenarios?.length}`
    return null
  })
  record('GET /api/state (seed idempotente + agregado)', state.ok, state.detail)

  record('GET /api/campaigns (archivo)', (await checkJson('/api/campaigns')).ok)
  record('GET /api/knowledge (memoria completa)', (await checkJson('/api/knowledge')).ok)

  const home = await fetch(`${BASE}/`)
  const html = await home.text().catch(() => '')
  record('GET / (panel de mando)', home.ok && html.includes('area'), `HTTP ${home.status}`)
}

// ── Fase 5 (opt-in): campaña real end-to-end ────────────────
if (process.env.SMOKE_START_CAMPAIGN === '1' && up) {
  console.log('── Fase 5: campaña real end-to-end (SMOKE_START_CAMPAIGN)')

  // captura previa de la memoria: para validar que /api/knowledge crece
  // con las lecciones de ESTA campaña (refino Ronda 6)
  const kBefore = await fetch(`${BASE}/api/knowledge`)
    .then((r) => (r.ok ? r.json().catch(() => null) : null))
    .catch(() => null)
  const knowledgeBefore = Array.isArray(kBefore?.knowledge) ? kBefore.knowledge.length : null

  const launch = await fetch(`${BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}), // escenario aleatorio, modo motor por defecto
  })
  const launched = launch.ok ? await launch.json().catch(() => null) : null
  record(
    'POST /api/campaigns (lanzamiento)',
    launch.ok && !!launched?.campaignId,
    launch.ok ? `campaña ${launched.campaignId}` : `HTTP ${launch.status} ${launched?.error ?? ''}`
  )

  if (launched?.campaignId) {
    const id = launched.campaignId
    const deadline = Date.now() + 240_000
    let detail = null
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await fetch(`${BASE}/api/campaigns/${id}`).catch(() => null)
      const body = res?.ok ? await res.json().catch(() => null) : null
      if (body?.ok && body.campaign?.status !== 'RUNNING') {
        detail = body
        break
      }
    }

    record(
      'campaña end-to-end COMPLETED',
      detail?.campaign?.status === 'COMPLETED',
      detail ? `estado ${detail.campaign.status} · ronda ${detail.campaign.round}/${detail.campaign.maxRounds}` : 'timeout 240s sin finalizar'
    )
    record(
      'registro de eventos y lecciones',
      Array.isArray(detail?.events) && detail.events.length > 0 &&
        ['RED', 'BLUE', 'DRAW'].includes(detail.campaign?.winner),
      detail ? `eventos ${detail.events?.length ?? 0} · ganador ${detail.campaign?.winner}` : 'sin detalle'
    )

    // refino Ronda 6: la memoria global debe archivar lecciones de esta
    // campaña (/api/knowledge expone campaignId en cada lección)
    const kAfter = await fetch(`${BASE}/api/knowledge`)
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .catch(() => null)
    const lessons = Array.isArray(kAfter?.knowledge)
      ? kAfter.knowledge.filter((k) => k.campaignId === id)
      : []
    const capped = Array.isArray(kAfter?.knowledge) && kAfter.knowledge.length >= 1000
    const grew =
      knowledgeBefore !== null && Array.isArray(kAfter?.knowledge) && kAfter.knowledge.length > knowledgeBefore
    record(
      'lecciones archivadas en la memoria (campaignId)',
      lessons.length > 0 && (grew || capped || knowledgeBefore === null),
      Array.isArray(kAfter?.knowledge)
        ? `${lessons.length} lecciones de la campaña ${id} · memoria ${knowledgeBefore ?? '?'}→${kAfter.knowledge.length}`
        : 'no se pudo leer /api/knowledge'
    )
  }
} else if (process.env.SMOKE_START_CAMPAIGN === '1') {
  console.log('── Fase 5: omitida (el servidor no está en pie)')
}

server.kill('SIGTERM')
finish()

function finish() {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
  if (failed.length > 0) {
    console.log('FALLOS: ' + failed.map((f) => f.name).join(' | '))
    process.exit(1)
  }
  process.exit(0)
}
