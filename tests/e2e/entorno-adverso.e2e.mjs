#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-entorno-adverso — agente TEST (protocolo v2)
//
//   bun tests/e2e/entorno-adverso.e2e.mjs
//
// Arranques hostiles del standalone, cada uno en su instancia
// efímera con puerto y BD propios (no toca db/custom.db):
//
//   S1 · LAB_PORT inválido («abc») — el servidor arranca, el lab
//        cae al defecto 4403 (fix Ronda 12: NaN/0/negativos/>65535
//        ya no explotan en el camino del motor) y una campaña real
//        corre igualmente. Observable: state.lab.port ∈ [4403..4412]
//        (el runtime prueba hasta 10 puertos consecutivos).
//   S2 · LAB_PORT ocupado por un oyente ajeno — sin crash: el
//        runtime salta al puerto siguiente y la campaña corre.
//   S3 · DATABASE_URL relativa (file:sin-ruta) — Prisma resuelve
//        contra el directorio del cliente generado dentro del
//        standalone, CREA el fichero vacío (0 tablas, sin migración
//        automática) y /api lo clasifica como 503 db:down.
//   S4 · BD ausente (fichero borrado) — mismo camino clasificado:
//        503 db:down, portada 200, ficha 200, listado 500 sin fuga.
//   S5 · BD corrupta (bytes basura) — perpetúa como suite la
//        verificación de cierre de H-005.
//
// Aserción transversal: ningún escenario tumba el proceso, la
// portada responde 200 en todos y los cuerpos de error (500/503)
// no fugan pilas ni rutas.
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { Database } from 'bun:sqlite'

const ROOT = resolve(import.meta.dir, '../..')
const STANDALONE = resolve(ROOT, '.next/standalone/server.js')
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── arnés compartido: instancias efímeras con muerte verificada ──

function iniciar({ port, dbPath, labPort }) {
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}`, PORT: String(port), NODE_ENV: 'production' }
  if (labPort !== undefined) env.LAB_PORT = labPort
  const server = spawn('bun', [STANDALONE], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  server.stdout.on('data', (d) => (log += d))
  server.stderr.on('data', (d) => (log += d))
  return { server, log: () => log }
}

const sigueVivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

async function matar(instancia, etiqueta) {
  instancia.server.kill('SIGTERM')
  await sleep(2_000)
  if (instancia.server.pid && sigueVivo(instancia.server.pid)) {
    try { process.kill(instancia.server.pid, 'SIGKILL') } catch { /* ya muerto */ }
    await sleep(500)
  }
  record(`apagado · ${etiqueta}: proceso terminado de verdad`, !instancia.server.pid || !sigueVivo(instancia.server.pid), `pid=${instancia.server.pid ?? '—'}`)
}

async function esperarArranque(port, instancia, maxMs = 20_000) {
  const fin = Date.now() + maxMs
  while (Date.now() < fin) {
    const up = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.status).catch(() => null)
    if (up !== null) return up
    await sleep(500)
  }
  return null
}

const get = async (port, path) => {
  const res = await fetch(`http://127.0.0.1:${port}${path}`).catch(() => null)
  if (!res) return null
  const body = await res.text().catch(() => '')
  return { status: res.status, body }
}

// Los cuerpos de error no deben fugar pilas, rutas ni internals
const FUGAS = [' at ', '.ts:', 'node_modules', '/home/z', 'PrismaClient', 'Error:' + ' ']
function sinFuga(body) {
  return !FUGAS.some((m) => body.includes(m))
}

// S1/S2: el lab arranca en la primera campaña; state.lab.port lo delata
async function arrancarCampanaYVerLab(port) {
  const post = await fetch(`http://127.0.0.1:${port}/api/campaigns`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }).then((r) => r.json()).catch(() => null)
  if (!post?.campaignId) return { campaignId: null, labPort: null }
  const fin = Date.now() + 15_000
  while (Date.now() < fin) {
    await sleep(1_000)
    const st = await get(port, '/api/state').then((r) => (r ? JSON.parse(r.body) : null)).catch(() => null)
    if (st?.lab?.port) return { campaignId: post.campaignId, labPort: st.lab.port }
  }
  return { campaignId: post.campaignId, labPort: null }
}

// ═════════════════════════════════════════════════════════════
// Construcción del standalone (SIEMPRE sobre main actual)
// ═════════════════════════════════════════════════════════════

async function construir() {
  console.log('construyendo standalone sobre main actual…')
  const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  record('servidor · build de producción (main actual)', built.status === 0)
  if (built.status === 0) {
    cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
    cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
  }
  return built.status === 0
}

// ═════════════════════════════════════════════════════════════
// S1 — LAB_PORT inválido → defecto 4403 (fix Ronda 12)
// ═════════════════════════════════════════════════════════════

async function s1LabPortInvalido(dbPath) {
  const PORT = 3116
  rmSync(dbPath, { force: true }); rmSync(`${dbPath}-journal`, { force: true })
  spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${dbPath}` }, stdio: 'pipe', encoding: 'utf8' })

  const inst = iniciar({ port: PORT, dbPath, labPort: 'abc' })
  const portada = await esperarArranque(PORT, inst)
  record('S1 · LAB_PORT="abc": el servidor arranca y la portada responde', portada === 200, `status=${portada}`)

  const health = await get(PORT, '/api')
  record('S1 · /api saludable (db:up) con el LAB_PORT inválido pendiente', health?.status === 200 && health.body.includes('"db":"up"'), health?.body.slice(0, 80))

  const { campaignId, labPort } = await arrancarCampanaYVerLab(PORT)
  record('S1 · campaña real arrancada pese al LAB_PORT inválido', !!campaignId && !!labPort, `campaña=${campaignId ?? '—'} lab=${labPort ?? '—'}`)
  record('S1 · el lab cayó al defecto con margen de reintento (4403..4412, fix Ronda 12)', labPort !== null && labPort >= 4403 && labPort <= 4412, `lab.port=${labPort}`)

  const st = await get(PORT, '/api/state')
  record('S1 · /api/state sigue operativa con la campaña viva', st?.status === 200 && st.body.includes('RUNNING'), `status=${st?.status}`)
  await matar(inst, 'S1')
}

// ═════════════════════════════════════════════════════════════
// S2 — LAB_PORT ocupado por un oyente ajeno → salta al siguiente
// ═════════════════════════════════════════════════════════════

async function s2LabPortOcupado(dbPath) {
  const PORT = 3117
  const OCUPADO = 4425
  rmSync(dbPath, { force: true }); rmSync(`${dbPath}-journal`, { force: true })
  spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${dbPath}` }, stdio: 'pipe', encoding: 'utf8' })

  const oyente = createServer((socket) => socket.destroy())
  const ocupado = await new Promise((ok) => oyente.once('error', () => ok(false)).once('listening', () => ok(true)).listen(OCUPADO, '127.0.0.1'))
  record('S2 · oyente ajeno ocupando el puerto 4425', ocupado === true, `listen=${ocupado ? 'OK' : 'fallo'}`)

  const inst = iniciar({ port: PORT, dbPath, labPort: String(OCUPADO) })
  const portada = await esperarArranque(PORT, inst)
  record('S2 · el servidor arranca aunque su LAB_PORT esté ocupado', portada === 200, `status=${portada}`)

  const { campaignId, labPort } = await arrancarCampanaYVerLab(PORT)
  record('S2 · campaña real arrancada con el puerto deseado ocupado', !!campaignId && !!labPort, `campaña=${campaignId ?? '—'} lab=${labPort ?? '—'}`)
  record('S2 · el lab saltó a un puerto libre del margen (4425..4434) sin tocar el ajeno', labPort !== null && labPort >= OCUPADO && labPort <= OCUPADO + 9 && labPort !== OCUPADO, `lab.port=${labPort}`)

  oyente.close()
  await matar(inst, 'S2')
}

// ═════════════════════════════════════════════════════════════
// S3 — DATABASE_URL relativa → resuelve contra el cliente generado
// ═════════════════════════════════════════════════════════════

async function s3DbUrlRelativa() {
  const PORT = 3118
  const RELATIVA = 'e2e-relativa-adverso.db'
  const esperada = resolve(ROOT, '.next/standalone/node_modules/.prisma/client', RELATIVA)
  rmSync(esperada, { force: true }); rmSync(`${esperada}-journal`, { force: true })

  const inst = iniciar({ port: PORT, dbPath: RELATIVA, labPort: '4435' })
  const portada = await esperarArranque(PORT, inst)
  record('S3 · DATABASE_URL relativa: el servidor arranca', portada === 200, `status=${portada}`)

  const health = await get(PORT, '/api')
  record('S3 · /api clasifica la BD vacía como 503 db:down (sin migración automática)', health?.status === 503 && health.body.includes('"db":"down"') && sinFuga(health.body), `${health?.status} ${health?.body.slice(0, 60)}`)

  const creada = existsSync(esperada)
  record('S3 · resolución determinista: el fichero nace junto al cliente generado del standalone', creada, esperada.replace(ROOT, '…'))

  let vacia = false
  if (creada) {
    try {
      const d = new Database(esperada, { readonly: true })
      vacia = d.query("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n === 0
      d.close()
    } catch { vacia = false }
  }
  record('S3 · el fichero relativo nace VACÍO (0 tablas): la degradación es db:down, no datos perdidos', vacia, '')

  await matar(inst, 'S3')
  rmSync(esperada, { force: true }); rmSync(`${esperada}-journal`, { force: true })
}

// ═════════════════════════════════════════════════════════════
// S4 — BD ausente (fichero borrado) + S5 — BD corrupta (H-005)
// ═════════════════════════════════════════════════════════════

async function escenarioBdRota({ port, dbPath, etiqueta, preparar }) {
  rmSync(dbPath, { force: true }); rmSync(`${dbPath}-journal`, { force: true })
  await preparar(dbPath)

  const inst = iniciar({ port, dbPath, labPort: '4436' })
  const portada = await esperarArranque(port, inst)
  record(`${etiqueta} · el servidor arranca y la portada responde 200`, portada === 200, `status=${portada}`)

  const health = await get(port, '/api')
  record(`${etiqueta} · /api → 503 db:down clasificado y sin fuga`, health?.status === 503 && health.body.includes('"db":"down"') && sinFuga(health.body), `${health?.status} ${health?.body.slice(0, 60)}`)

  const listado = await get(port, '/api/campaigns')
  record(`${etiqueta} · /api/campaigns → 500 genérico sin fuga de internals`, listado?.status === 500 && sinFuga(listado.body), `${listado?.status}`)

  const ficha = await get(port, '/historial/id-falso')
  record(`${etiqueta} · ficha con id falso → 200 (shell con estado de error, no 500)`, ficha?.status === 200, `status=${ficha?.status}`)

  await matar(inst, etiqueta)
}

async function main() {
  if (!(await construir())) return

  // S1 y S2: campañas reales contra BDs dedicadas sanas
  await s1LabPortInvalido(resolve(ROOT, 'db/e2e-adverso-lab-invalido.db'))
  await s2LabPortOcupado(resolve(ROOT, 'db/e2e-adverso-lab-ocupado.db'))

  // S3: URL relativa (no hay db push: el punto ES la BD vacía)
  await s3DbUrlRelativa()

  // S4: fichero inexistente al arrancar
  await escenarioBdRota({
    port: 3119, dbPath: resolve(ROOT, 'db/e2e-adverso-ausente.db'), etiqueta: 'S4',
    preparar: async (p) => { rmSync(p, { force: true }) },
  })

  // S5: bytes basura (perpetúa la verificación de cierre de H-005)
  await escenarioBdRota({
    port: 3120, dbPath: resolve(ROOT, 'db/e2e-adverso-corrupta.db'), etiqueta: 'S5',
    preparar: async (p) => {
      const ruido = Buffer.from(Array.from({ length: 2048 }, (_, i) => 65 + ((i * 31) % 26)))
      writeFileSync(p, ruido)
    },
  })
}

await main()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
