#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-actualizacion-bd — agente TEST (protocolo v2)
//
//   bun tests/e2e/actualizacion-bd.e2e.mjs
//
// «Abrir una BD de una versión anterior con el esquema nuevo».
// La BD anterior se construye de forma HONESTA desde git: se
// extrae el schema.prisma de la revisión ANTERIOR al último commit
// que AÑADIÓ columnas a Campaign (hoy: 59148c7, que añadió
// Campaign.adaptativa y Campaign.ajusteDefensa — mañana será otro,
// la suite lo detecta dinámicamente recorriendo el historial; los
// commits que solo tocan comentarios del schema no cuentan,
// lección del workflow ci-basico con 8ef8309), se crea con prisma
// db push y se siembra por SQL directo (bun:sqlite) con 5 campañas
// históricas y sus eventos.
//
//   F1 · BD versión anterior — schema de git + siembra histórica
//        verificando por PRAGMA que las columnas nuevas NO existen.
//   F2 · ARRANQUE SIN MIGRAR — el servidor actual sobre la BD vieja:
//        portada 200, healthcheck /api VERDE (la tabla Setting no
//        cambió: el ping no detecta esquema desactualizado —
//        observación de observabilidad documentada en el estado) y
//        las rutas que consultan Campaign degradan 500 clasificado
//        SIN fuga de pilas/rutas (barrido de marcadores).
//   F3 · RECUPERACIÓN por el camino documentado — `prisma db push`
//        del schema nuevo sobre la BD vieja SIN --force: debe ser
//        sin pérdida; verificación directa de filas preservadas y
//        columnas nuevas con sus valores históricos (seed=NULL,
//        determinista=false — el contrato «null en filas históricas»).
//   F4 · APP ACTUALIZADA — reinicio sobre la misma BD: portada 200,
//        /api db:up, listado con las 5 históricas, detail con sus
//        eventos, y una campaña NUEVA determinista {seed:2026,
//        determinista:true} (la feature que trajo las columnas)
//        corre COMPLETA y convive con los históricos en el listado.
//
// Transversal: apagado por PID en ambas instancias, fichero temporal
// de schema siempre borrado, cero fugas en los cuerpos de error.
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Database } from 'bun:sqlite'

const ROOT = resolve(import.meta.dir, '../..')
const STANDALONE = resolve(ROOT, '.next/standalone/server.js')
const PORT = 3115
const BASE = `http://127.0.0.1:${PORT}`
const DB_PATH = resolve(ROOT, 'db/e2e-actualizacion.db')
const SCHEMA_VIEJO = resolve(ROOT, 'prisma/.schema-anterior-e2e.prisma')

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ms = (t0) => Math.round(performance.now() - t0)

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`).catch(() => null)
  if (!res) return { status: 0, body: '' }
  const body = await res.text().catch(() => '')
  return { status: res.status, body }
}
const getJson = async (path) => {
  const r = await get(path)
  let json = null
  try { json = JSON.parse(r.body) } catch { /* clasificado abajo */ }
  return { ...r, json }
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

// Los cuerpos de error no deben fugar pilas, rutas ni internals
const FUGAS = [' at ', '.ts:', 'node_modules', '/home/z', 'PrismaClient', 'no such column', 'SQLite']
function sinFuga(body) {
  return !FUGAS.some((m) => body.includes(m))
}

// ── F0: detectar dinámicamente el último cambio de schema y extraer
// la versión ANTERIOR (la suite sobrevive a futuros cambios de schema) ──

function extraerSchemaAnterior() {
  // Recorrer el historial del schema y quedarse con el último commit que
  // AÑADIÓ columnas al model Campaign — no basta con «el último que tocó
  // el fichero»: 8ef8309 (paquete-nombre) lo tocó solo para renombrar un
  // comentario y dejó la detección sin columnas nuevas (descubierto por
  // la simulación del workflow ci-basico, sesión 11).
  const candidatos = spawnSync('git', ['log', '-n20', '--format=%H', '--', 'prisma/schema.prisma'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean)
  let ultimo = null
  let nuevas = []
  for (const c of candidatos) {
    const diff = spawnSync('git', ['diff', `${c}~1`, c, '--', 'prisma/schema.prisma'], { cwd: ROOT, encoding: 'utf8' }).stdout
    let modelo = ''
    const cols = []
    for (const linea of diff.split('\n')) {
      const h = linea.match(/^@@\s+.*@@\s+model\s+(\w+)/)
      if (h) { modelo = h[1]; continue }
      if (modelo !== 'Campaign') continue
      // líneas «+  campo Tipo…» (los comentarios «+  //» no casan:
      // el tipo debe empezar por mayúscula)
      const f = linea.match(/^\+\s+([a-zA-Z]\w*)\s+[A-Z]\w*/)
      if (f && !cols.includes(f[1])) cols.push(f[1])
    }
    if (cols.length > 0) { ultimo = c; nuevas = cols; break }
  }
  if (!ultimo) {
    record('F0 · extracción del schema anterior desde git', false, 'ningún commit de los últimos 20 añade columnas a Campaign')
    return null
  }
  const anterior = spawnSync('git', ['show', `${ultimo}~1:prisma/schema.prisma`], { cwd: ROOT, encoding: 'utf8' })
  if (anterior.status !== 0 || !anterior.stdout.includes('model Campaign')) {
    record('F0 · extracción del schema anterior desde git', false, `commit=${ultimo.slice(0, 8)} ${anterior.stderr?.slice(-150)}`)
    return null
  }
  rmSync(SCHEMA_VIEJO, { force: true })
  writeFileSync(SCHEMA_VIEJO, anterior.stdout)
  record('F0 · schema anterior extraído desde git (revisión previa al último commit que AÑADIÓ columnas) + columnas nuevas detectadas', nuevas.length > 0, `base=${ultimo.slice(0, 8)} columnas nuevas=[${nuevas.join(', ')}]`)
  if (nuevas.length === 0) return null
  return { base: ultimo.slice(0, 8), nuevas }
}

// ── F1: crear BD con el schema VIEJO y sembrar históricos por SQL ──

async function crearBdAnterior(nuevas) {
  process.env.DATABASE_URL = `file:${DB_PATH}`
  rmSync(DB_PATH, { force: true })
  rmSync(`${DB_PATH}-journal`, { force: true })
  const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate', '--schema', SCHEMA_VIEJO], {
    cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` }, stdio: 'pipe', encoding: 'utf8',
  })
  record('F1 · prisma db push con el schema ANTERIOR (BD dedicada e2e-actualizacion.db)', push.status === 0, push.status === 0 ? DB_PATH : push.stderr.slice(-200))
  if (push.status !== 0) return false

  // Verificación de la premisa + siembra histórica por SQL directo
  // (mismas conexión de escritura para ambas cosas)
  const db = new Database(DB_PATH)
  const cols = db.prepare('PRAGMA table_info(Campaign)').all().map((c) => c.name)
  const faltan = nuevas.filter((c) => !cols.includes(c))
  record('F1 · la BD nace SIN las columnas nuevas del schema actual (premisa de la actualización pendiente)', faltan.length === nuevas.length, `faltan=[${faltan.join(', ')}]`)
  if (faltan.length !== nuevas.length) { db.close(); return false }

  // Siembra histórica por SQL directo (solo columnas del schema viejo).
  // La infrastructure es una infraestructura VÁLIDA de 2 nodos (misma
  // forma que el roster): F4 lanza una campaña REAL y si el escenario
  // elegido tuviera «nodes» vacío el motor abortaría — robustez del
  // motor ante infra inválida es otro asunto (hallazgo documentado en
  // el estado), el foco de esta suite es la ACTUALIZACIÓN de la BD.
  const INFRA_HIST = JSON.stringify({
    nodes: [
      { id: 'fw-hist', name: 'Firewall Histórico', type: 'VPN', ip: '10.9.0.1', segment: 'DMZ', criticality: 5, vulnerabilities: ['Regla antigua'], controls: ['IPS básico'] },
      { id: 'srv-hist', name: 'Servidor Histórico', type: 'WEB', ip: '10.9.1.10', segment: 'INT', criticality: 4, vulnerabilities: ['TLS viejo'], controls: ['WAF básico'] },
    ],
  })
  db.prepare(`INSERT INTO Scenario (id, key, codename, company, industry, difficulty, description, infrastructure, redObjective, blueObjective, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'hist-sc-1', 'hist-volumen', 'BOLA', 'Cifra Bank', 'Banca', 3,
    'escenario de la versión anterior (siembra e2e-actualizacion-bd)',
    INFRA_HIST, 'objetivo rojo', 'objetivo azul', '2026-09-01 10:00:00')
  const CAMPAÑAS = [
    { id: 'hist-camp-1', winner: 'RED', red: 92, blue: 31, rp: 100, bp: 40, ini: '2026-09-01 10:00:00' },
    { id: 'hist-camp-2', winner: 'BLUE', red: 22, blue: 87, rp: 35, bp: 95, ini: '2026-09-02 10:00:00' },
    { id: 'hist-camp-3', winner: 'DRAW', red: 45, blue: 44, rp: 55, bp: 50, ini: '2026-09-03 10:00:00' },
    { id: 'hist-camp-4', winner: 'RED', red: 78, blue: 12, rp: 90, bp: 20, ini: '2026-09-04 10:00:00' },
    { id: 'hist-camp-5', winner: 'BLUE', red: 30, blue: 91, rp: 25, bp: 98, ini: '2026-09-05 10:00:00' },
  ]
  const insertC = db.prepare(`INSERT INTO Campaign (id, status, phase, round, maxRounds, redScore, blueScore, redProgress, blueProgress, winner, narrative, engineMode, startedAt, endedAt, scenarioId)
                              VALUES (?, 'COMPLETED', 'CIERRE', 8, 8, ?, ?, ?, ?, ?, ?, 'SIM', ?, ?, 'hist-sc-1')`)
  for (const c of CAMPAÑAS) {
    insertC.run(c.id, c.red, c.blue, c.rp, c.bp, c.winner, `campaña histórica ${c.id} — datos de la versión anterior del esquema`, c.ini, '2026-09-06 10:00:00')
  }
  const insertE = db.prepare(`INSERT INTO CampaignEvent (id, campaignId, seq, round, phase, team, agentKey, agentCodename, action, detail, result, impact, severity, targetNode, command, evidence, createdAt)
                              VALUES (?, 'hist-camp-1', ?, ?, 'RECON', 'RED', 'ag-1', 'Zorro Histórico', 'sondeo', ?, 'EXITO', 1, 'LOW', 'srv-01', NULL, NULL, ?)`)
  insertE.run('hist-ev-1', 1, 1, 'evento histórico 1 de hist-camp-1', '2026-09-01 10:01:00')
  insertE.run('hist-ev-2', 2, 1, 'evento histórico 2 de hist-camp-1', '2026-09-01 10:02:00')
  insertE.run('hist-ev-3', 3, 2, 'evento histórico 3 de hist-camp-1', '2026-09-01 10:03:00')

  // 1 lección ENLAZADA a la campaña histórica: así el include de
  // campaña en /api/knowledge consulta de verdad Campaign con
  // columnas nuevas (con include vacío sería no-op y devolvería 200
  // incluso con esquema desactualizado — matiz de F2)
  db.prepare(`INSERT INTO Knowledge (id, team, campaignId, agentKey, agentCodename, category, title, content, tags, confidence, timesUsed, timesWorked, createdAt)
              VALUES ('hist-kn-1', 'RED', 'hist-camp-1', 'ag-1', 'Zorro Histórico', 'LECCION', 'Lección histórica', 'lección sembrada en la BD de la versión anterior, enlazada a hist-camp-1', 'historica,actualizacion', 0.7, 3, 2, '2026-09-01 11:00:00')`).run()

  const conteo = db.prepare('SELECT COUNT(*) AS n FROM Campaign').get().n
  const evs = db.prepare('SELECT COUNT(*) AS n FROM CampaignEvent').get().n
  const kns = db.prepare('SELECT COUNT(*) AS n FROM Knowledge').get().n
  db.close()
  record('F1 · 5 campañas históricas + 3 eventos + 1 lección enlazada sembrados por SQL directo en la BD vieja', conteo === 5 && evs === 3 && kns === 1, `campañas=${conteo} eventos=${evs} lecciones=${kns}`)
  return conteo === 5
}

// ── F2: arranque del servidor ACTUAL sobre la BD vieja (sin migrar) ──

function iniciar() {
  const server = spawn('bun', [STANDALONE], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}`, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  server.stdout.on('data', (d) => (log += d))
  server.stderr.on('data', (d) => (log += d))
  return { server, log: () => log }
}

async function esperarArranque(maxMs = 25_000) {
  const fin = Date.now() + maxMs
  while (Date.now() < fin) {
    const up = await fetch(`${BASE}/`).then((r) => r.status).catch(() => null)
    if (up !== null) return up
    await sleep(500)
  }
  return null
}

const CINCO_XX = []
const marcas = []

async function faseSinMigrar() {
  const portada = await esperarArranque()
  record('F2 · el servidor ACTUAL arranca sobre la BD sin migrar y la portada responde 200', portada === 200, `status=${portada}`)

  const health = await getJson('/api')
  marcas.push({ ruta: '/api', status: health.status, ok: health.json?.ok === true && health.json?.db === 'up' })
  record('F2 · healthcheck /api da db:up VERDE con esquema desactualizado (ping a Setting, que no cambió — observación de observabilidad)', health.status === 200 && health.json?.db === 'up', `status=${health.status} db=${health.json?.db ?? '—'}`)

  // Rutas que consultan Campaign con columnas nuevas → degradan
  // clasificado. /api/knowledge también falla porque su include de
  // campaña NO es vacío (hist-kn-1 referencia hist-camp-1): con
  // include vacío el include sería no-op y devolvería 200 incluso
  // con esquema desactualizado (matiz observado y documentado).
  const rutasCampaign = ['/api/campaigns', '/api/state', '/api/knowledge', '/api/campaigns/hist-camp-1']
  for (const r of rutasCampaign) {
    const resp = await get(r)
    const cuerpoOk = resp.body.includes('"ok":false')
    const limpio = !sinFuga(resp.body) === false || !resp.body.includes('no such column') // sin fuga Y sin detalle interno
    const clasificado = resp.status >= 400 && resp.status < 600 && cuerpoOk && sinFuga(resp.body)
    if (resp.status >= 500) CINCO_XX.push(`${r}=${resp.status}`)
    record(`F2 · ${r} con esquema desactualizado: error clasificado ${resp.status} sin fuga de internals`, clasificado && limpio, `status=${resp.status} cuerpo=${resp.body.slice(0, 60)}`)
  }
  record('F2 · las 4 rutas de Campaign fallan de forma consistente (ninguna fuga, ninguna colgó)', CINCO_XX.length === rutasCampaign.length, `statuses=${CINCO_XX.join(' ')}`)
}

// ── F3: recuperación por el camino documentado (prisma db push) ──

function faseRecuperacion(nuevas) {
  const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` }, stdio: 'pipe', encoding: 'utf8',
  })
  record('F3 · prisma db push del schema ACTUAL sobre la BD vieja (camino documentado, sin --force)', push.status === 0, push.status === 0 ? 'sin pérdida' : push.stderr.slice(-200))
  if (push.status !== 0) return false

  const db = new Database(DB_PATH, { readonly: true })
  const cols = db.prepare('PRAGMA table_info(Campaign)').all().map((c) => c.name)
  const presentes = nuevas.filter((c) => cols.includes(c))
  const campañas = db.prepare('SELECT COUNT(*) AS n FROM Campaign').get().n
  const evs = db.prepare('SELECT COUNT(*) AS n FROM CampaignEvent').get().n
  const hist = db.prepare(`SELECT seed, determinista FROM Campaign WHERE id='hist-camp-1'`).get()
  db.close()

  const filas = campañas === 5 && evs === 3
  record('F3 · columnas nuevas añadidas y TODAS las filas históricas preservadas (5 campañas, 3 eventos)', presentes.length === nuevas.length && filas, `columnas=[${presentes.join(', ')}] campañas=${campañas} eventos=${evs}`)
  record('F3 · históricas quedan con el contrato «null en filas anteriores»: seed=NULL y determinista=false', hist && hist.seed === null && (hist.determinista === 0 || hist.determinista === false), `seed=${hist?.seed} determinista=${hist?.determinista}`)
  return filas
}

// ── F4: app actualizada corriendo sobre la BD actualizada ──

async function faseActualizada() {
  const portada = await esperarArranque()
  record('F4 · tras la actualización, la portada responde 200', portada === 200, `status=${portada}`)
  const health = await getJson('/api')
  record('F4 · /api db:up tras actualizar el esquema', health.status === 200 && health.json?.db === 'up', `db=${health.json?.db ?? '—'}`)

  const lista = await getJson('/api/campaigns')
  const ids = (lista.json?.campaigns ?? []).map((c) => c.id)
  const historicas = ['hist-camp-1', 'hist-camp-2', 'hist-camp-3', 'hist-camp-4', 'hist-camp-5'].every((id) => ids.includes(id))
  record('F4 · el listado entrega las 5 campañas históricas con el esquema NUEVO', lista.status === 200 && lista.json?.ok === true && historicas && ids.length === 5, `status=${lista.status} filas=${ids.length} primera=${ids[0] ?? '—'}`)

  const primera = lista.json?.campaigns?.[0]
  record('F4 · datos históricos íntegros tras la actualización (winner, scores, scenario join)', !!primera && !!primera.scenario?.codename && typeof primera.redScore === 'number', `codename=${primera?.scenario?.codename ?? '—'} red=${primera?.redScore}`)

  const detalle = await getJson('/api/campaigns/hist-camp-1')
  record('F4 · detail de una histórica: sus 3 eventos sembrados accesibles con el esquema nuevo', detalle.status === 200 && detalle.json?.ok === true && detalle.json?.events?.length === 3, `eventos=${detalle.json?.events?.length ?? '—'}`)

  // La feature que trajo las columnas corre sobre la BD actualizada:
  // campaña nueva determinista {seed:2026, determinista:true}
  const post = await fetch(`${BASE}/api/campaigns`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ determinista: true, seed: 2026 }),
  }).then((r) => r.json()).catch(() => null)
  record('F4 · POST {determinista:true, seed:2026} aceptado sobre la BD actualizada (eco de la feature nueva)', !!post?.campaignId && post?.determinista === true && post?.seed === 2026, `campaña=${post?.campaignId ?? '—'} determinista=${post?.determinista} seed=${post?.seed}`)

  // Esperar COMPLETED sondeando el DETAIL (patrón golden-path): el
  // bucle corre en segundo plano (void runCampaign), el poll solo
  // observa. Timeout 90 s: la determinista SIM es local pero el
  // bucle tiene pausas de 500 ms por evento.
  let final = null
  let ultimoEstado = '—'
  const fin = Date.now() + 90_000
  while (Date.now() < fin && !final) {
    await sleep(2_000)
    const det = await getJson(`/api/campaigns/${post.campaignId}`)
    ultimoEstado = det.json?.campaign?.status ?? `HTTP ${det.status}`
    if (ultimoEstado === 'COMPLETED') final = det.json?.campaign
  }
  record('F4 · la campaña nueva termina COMPLETA y convive con las históricas en el mismo archivo', !!final && final.winner !== undefined, `estado=${final?.status ?? ultimoEstado} winner=${final?.winner ?? '—'} motor=${final?.engineMode ?? '—'}`)

  const lista2 = await getJson('/api/campaigns')
  const ids2 = (lista2.json?.campaigns ?? []).map((c) => c.id)
  record('F4 · listado final: 6 campañas (5 históricas + 1 nueva determinista con seed guardada)', lista2.status === 200 && ids2.length === 6 && ids2.includes(post?.campaignId), `filas=${ids2.length} nueva presente=${ids2.includes(post?.campaignId)}`)

  const know2 = await getJson('/api/knowledge')
  const leccion = (know2.json?.knowledge ?? []).find((k) => k.id === 'hist-kn-1')
  record('F4 · /api/knowledge restaurado: la lección histórica enlazada sale con su campaña de origen', know2.status === 200 && know2.json?.ok === true && !!leccion && leccion.campaignCodename === 'BOLA', `status=${know2.status} campaignCodename=${leccion?.campaignCodename ?? '—'}`)
}

// ═════════════════════════════════════════════════════════════
// PRINCIPAL
// ═════════════════════════════════════════════════════════════

try {
  const base = extraerSchemaAnterior()
  if (!base) process.exit(1)

  console.log('construyendo standalone sobre main actual…')
  const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
  record('servidor · build de producción (main actual)', built.status === 0, built.status === 0 ? 'OK' : built.stderr?.slice(-300))
  if (built.status !== 0) process.exit(1)
  cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
  cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })

  if (!(await crearBdAnterior(base.nuevas))) process.exit(1)

  // F2 — sin migrar
  const inst1 = iniciar()
  try {
    await faseSinMigrar()
  } finally {
    await matar(inst1, 'F2 (BD sin migrar)')
  }

  // F3 — recuperación
  if (!faseRecuperacion(base.nuevas)) process.exit(1)

  // F4 — app actualizada
  const inst2 = iniciar()
  try {
    await faseActualizada()
  } finally {
    await matar(inst2, 'F4 (BD actualizada)')
  }
} finally {
  rmSync(SCHEMA_VIEJO, { force: true }) // fichero temporal de schema siempre borrado
}

const fallos = results.filter((r) => !r.ok)
console.log(`\n${results.length - fallos.length}/${results.length} OK — e2e-actualizacion-bd (actualización de BD versión anterior → esquema nuevo)`)
if (fallos.length) {
  console.log('FALLOS:')
  for (const f of fallos) console.log(` · ${f.name}`)
  process.exit(1)
}
