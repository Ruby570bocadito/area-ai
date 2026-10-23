#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-volumen — agente TEST (protocolo v2)
//
//   bun tests/e2e/volumen.e2e.mjs
//
// Volumen: 1 000 campañas COMPLETED sembradas directamente en BD
// dedicada (createMany, sin LLM ni lanzamientos reales — el motor
// no participa: IMP-1 está refactorizándolo y esta suite no debe
// depender de él), y tres capas de medición contra un standalone
// real de main:
//
//   C1 · historial a volumen — GET /api/campaigns con 1 000 en BD
//        debe entregar EXACTAMENTE las 500 más recientes (tope
//        take:500 documentado en la ruta), en orden desc estricto,
//        con marcadores reconocibles; el truncado NO rompe el
//        acceso directo por id a la campaña 501. Latencias p50/p95
//        de /api/campaigns, /api/state (solo 15 recientes) y
//        /api/campaigns/[id] (12 eventos sembrados) sobre iteraciones
//        repetidas, con umbrales generosos y estables para CI: los
//        valores medidos se registran como evidencia, no como roca.
//   C2 · render + búsqueda — HistoryPanel REAL vía react-dom/server
//        (patrón de historial-filtros) con las 500 campañas que
//        entrega el servidor: contador «500 de 500», fichas
//        enlazadas, deep-link ?resultado=RED y ?escenario= aplicados
//        a volumen con conteo esperado calculado desde el propio DTO,
//        y el pipeline de búsqueda real (normalizeText) cronometrado
//        sobre los 500 DTOs (términos con y sin acento).
//   C3 · exportación a volumen — los exportadores reales que
//        alimentan los botones de descarga: buildAggregateReport
//        (informe .md del historial) con 500 campañas reales,
//        buildEventsCsv/buildEventsJson sobre el detalle real de una
//        campaña con sus 12 eventos, y buildKnowledgeCsv/
//        buildKnowledgeJson sobre los 1 000 items que entrega
//        /api/knowledge (tope take:1000). Integridad de filas +
//        latencia cronometrada.
//
// Transversal: cero 5xx en toda la sesión HTTP y apagado del
// standalone verificado por PID (signal-0).
//
// Inmunidad al seed del servidor: /api/state dispara ensureSeed()
// (roster + conocimiento fundacional), así que las aserciones de
// knowledge cuentan desde los items DEVUELTOS por el servidor, no
// desde la siembra.
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

const ROOT = resolve(import.meta.dir, '../..')
const STANDALONE = resolve(ROOT, '.next/standalone/server.js')
const PORT = 3115
const BASE = `http://127.0.0.1:${PORT}`
const DB_PATH = resolve(ROOT, 'db/e2e-volumen.db')
const N_CAMPAIGN = 1_000
const EVENTOS_POR_CAMPANA = 12
const TOPE_LISTADO = 500 // take:500 documentado en /api/campaigns

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ms = (t0) => Math.round(performance.now() - t0)
const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] ?? null

// Cronometra iteraciones de una promesa; devuelve tiempos y última respuesta
async function cronometrar(fn, iter) {
  const tiempos = []
  let ultima = null
  for (let i = 0; i < iter; i++) {
    const t0 = performance.now()
    ultima = await fn()
    tiempos.push(ms(t0))
  }
  return { tiempos, ultima, p50: pct(tiempos, 0.5), p95: pct(tiempos, 0.95), max: Math.max(...tiempos) }
}

const get = async (path) => {
  const t0 = performance.now()
  const res = await fetch(`${BASE}${path}`).catch(() => null)
  if (!res) return { status: 0, body: '', t: ms(t0) }
  const body = await res.text().catch(() => '')
  return { status: res.status, body, t: ms(t0) }
}
const getJson = async (path) => {
  const r = await get(path)
  let json = null
  try { json = JSON.parse(r.body) } catch { /* clasificado abajo */ }
  return { ...r, json }
}

const sigueVivo = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

// ═════════════════════════════════════════════════════════════
// FASE 0 — build del standalone (SIEMPRE sobre main actual) + siembra
// ═════════════════════════════════════════════════════════════

async function construir() {
  console.log('construyendo standalone sobre main actual…')
  const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
  record('servidor · build de producción (main actual)', built.status === 0, built.status === 0 ? 'OK' : built.stderr?.slice(-300))
  if (built.status !== 0) return false
  cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
  cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
  return true
}

// El env del contenedor exporta DATABASE_URL ajena al repo: la suite
// fija la SUYA antes de tocar Prisma (hallazgo de la sesión 5).
async function sembrar() {
  process.env.DATABASE_URL = `file:${DB_PATH}`
  rmSync(DB_PATH, { force: true })
  rmSync(`${DB_PATH}-journal`, { force: true })
  const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` }, stdio: 'pipe', encoding: 'utf8',
  })
  record('siembra · prisma db push (BD dedicada e2e-volumen.db)', push.status === 0, push.status === 0 ? DB_PATH : push.stderr.slice(-300))
  if (push.status !== 0) return null

  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient()
  const t0 = performance.now()

  // 4 escenarios propios (keys vol-*, sin colisión con el roster del
  // ensureSeed del servidor) — 2 de ellos con industry con acento
  // para la búsqueda normalizada.
  const escenarios = [
    { id: 'vol-sc-1', key: 'vol-banca', codename: 'BOLA', company: 'Cifra Bank', industry: 'Banca', difficulty: 3, description: 'escenario de volumen 1', infrastructure: '{"nodes":[]}', redObjective: 'objetivo rojo', blueObjective: 'objetivo azul' },
    { id: 'vol-sc-2', key: 'vol-seguros', codename: 'PHISHING', company: 'Seguros del Prado', industry: 'Seguros', difficulty: 2, description: 'escenario de volumen 2', infrastructure: '{"nodes":[]}', redObjective: 'objetivo rojo', blueObjective: 'objetivo azul' },
    { id: 'vol-sc-3', key: 'vol-energia', codename: 'TENSION', company: 'Red Eléctrica del Sur', industry: 'Energía', difficulty: 4, description: 'escenario de volumen 3', infrastructure: '{"nodes":[]}', redObjective: 'objetivo rojo', blueObjective: 'objetivo azul' },
    { id: 'vol-sc-4', key: 'vol-logistica', codename: 'CADENA', company: 'Logística Ágil', industry: 'Logística', difficulty: 1, description: 'escenario de volumen 4', infrastructure: '{"nodes":[]}', redObjective: 'objetivo rojo', blueObjective: 'objetivo azul' },
  ]
  for (const e of escenarios) {
    await db.scenario.upsert({ where: { id: e.id }, update: e, create: e })
  }

  // 1 000 campañas COMPLETED: startedAt = base - i minutos → orden
  // desc determinista; winner patrón i%5 (400 RED / 400 BLUE / 200
  // DRAW en 1 000; 200/200/100 en las 500 visibles). Marcadores:
  // vol-camp-0000 es la MÁS RECIENTE y vol-camp-0500 cae FUERA del
  // tope de 500 del listado.
  const BASE_MS = Date.now()
  const winnerDe = (i) => (i % 5 < 2 ? 'RED' : i % 5 < 4 ? 'BLUE' : 'DRAW')
  const campañas = Array.from({ length: N_CAMPAIGN }, (_, i) => {
    const startedAt = new Date(BASE_MS - i * 60_000)
    const winner = winnerDe(i)
    return {
      id: `vol-camp-${String(i).padStart(4, '0')}`,
      status: 'COMPLETED',
      phase: 'CIERRE',
      round: 8,
      maxRounds: 8,
      redScore: (i * 7) % 100,
      blueScore: (i * 13) % 100,
      redProgress: winner === 'RED' ? 60 + (i % 40) : i % 50,
      blueProgress: winner === 'BLUE' ? 60 + (i % 40) : i % 50,
      winner,
      narrative: `campaña de volumen #${i} — RED vs BLUE en ${escenarios[i % 4].company} (siembra determinista e2e-volumen)`,
      engineMode: i % 2 ? 'LLM' : 'SIM',
      seed: 1_000 + i,
      determinista: i % 2 === 0,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 15 * 60_000),
      scenarioId: escenarios[i % 4].id,
    }
  })
  await db.campaign.createMany({ data: campañas })

  // 12 eventos por campaña (12 000 filas, lotes de 1 000): el detalle
  // real /api/campaigns/[id] y su exportación tienen masa honesta.
  const FASES = ['RECON', 'WEAPONIZE', 'DELIVERY', 'EXPLOIT', 'PIVOT', 'OBJECTIVE']
  const RESULTADOS = ['EXITO', 'FALLO', 'DETECTADO', 'BLOQUEADO']
  const eventos = []
  for (let i = 0; i < N_CAMPAIGN; i++) {
    for (let seq = 1; seq <= EVENTOS_POR_CAMPANA; seq++) {
      eventos.push({
        campaignId: `vol-camp-${String(i).padStart(4, '0')}`,
        seq,
        round: Math.ceil(seq / 2),
        phase: FASES[(seq - 1) % FASES.length],
        team: seq % 2 ? 'RED' : 'BLUE',
        agentKey: `ag-${seq % 3}`,
        agentCodename: seq % 2 ? 'Zorro Vol' : 'Centinela Vol',
        action: seq % 2 ? 'sondeo' : 'parcheo',
        detail: `evento ${seq} de la campaña ${i} — siembra de volumen determinista para medir detalle y exportación`,
        result: RESULTADOS[seq % RESULTADOS.length],
        impact: seq % 5,
        severity: seq % 3 === 0 ? 'MEDIUM' : 'INFO',
        targetNode: 'srv-01',
        command: null,
        evidence: null,
      })
    }
  }
  for (let lote = 0; lote < eventos.length; lote += 1_000) {
    await db.campaignEvent.createMany({ data: eventos.slice(lote, lote + 1_000) })
  }

  // 1 knowledge por campaña (1 000 filas) — /api/knowledge tiene
  // tope take:1000, así que habrá masa suficiente aunque ensureSeed
  // del servidor añada el fundacional.
  const CATEGORIAS = ['LECCION', 'TACTICA', 'DEFENSA']
  const knowledges = Array.from({ length: N_CAMPAIGN }, (_, i) => ({
    team: i % 2 ? 'RED' : 'BLUE',
    campaignId: `vol-camp-${String(i).padStart(4, '0')}`,
    agentKey: `ag-${i % 3}`,
    agentCodename: i % 2 ? 'Zorro Vol' : 'Centinela Vol',
    category: CATEGORIAS[i % CATEGORIAS.length],
    title: `Lección de volumen #${i}`,
    content: `lección determinista ${i} — registro de masa para medir /api/knowledge y su exportación a tope`,
    tags: 'volumen,siembra',
    confidence: 0.5 + (i % 50) / 100,
    timesUsed: i % 10,
    timesWorked: i % 7,
    createdAt: new Date(BASE_MS - i * 60_000 + 16 * 60_000),
  }))
  await db.knowledge.createMany({ data: knowledges })

  const conteos = {
    escenarios: await db.scenario.count(),
    campañas: await db.campaign.count(),
    eventos: await db.campaignEvent.count(),
    knowledge: await db.knowledge.count(),
  }
  await db.$disconnect()
  record('siembra · 1 000 campañas COMPLETED + 12 000 eventos + 1 000 lecciones en BD dedicada', conteos.campañas === N_CAMPAIGN && conteos.eventos === N_CAMPAIGN * EVENTOS_POR_CAMPANA && conteos.knowledge >= N_CAMPAIGN, `campañas=${conteos.campañas} eventos=${conteos.eventos} knowledge=${conteos.knowledge} (≥1 000: el ensureSeed del servidor añadirá fundacional) en ${ms(t0)} ms`)
  return conteos
}

// ═════════════════════════════════════════════════════════════
// FASE 1 — servidor standalone con la BD sembrada
// ═════════════════════════════════════════════════════════════

async function arrancarServidor() {
  const server = spawn('bun', [STANDALONE], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}`, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  server.stdout.on('data', (d) => (log += d))
  server.stderr.on('data', (d) => (log += d))

  const fin = Date.now() + 25_000
  let portada = null
  while (Date.now() < fin && portada === null) {
    portada = await fetch(`${BASE}/`).then((r) => r.status).catch(() => null)
    if (portada === null) await sleep(500)
  }
  record('servidor · portada 200 sobre la BD sembrada', portada === 200, `status=${portada}`)

  const health = await getJson('/api')
  record('servidor · /api saludable con 1 000 campañas detrás', health.status === 200 && health.body.includes('"db":"up"'), `status=${health.status} ${health.body.slice(0, 60)}`)
  return { server, log: () => log }
}

// ═════════════════════════════════════════════════════════════
// FASE 2 — historial a volumen (HTTP)
// ═════════════════════════════════════════════════════════════

const CINCO_XX = []
async function faseHistorial() {
  // Listado + integridad del truncado
  const lista = await getJson('/api/campaigns')
  const items = lista.json?.campaigns ?? []
  record('historial · GET /api/campaigns entrega EXACTAMENTE 500 de 1 000 (tope take:500 documentado)', lista.status === 200 && lista.json?.ok === true && items.length === TOPE_LISTADO, `status=${lista.status} filas=${items.length} (${lista.t} ms)`)

  const ids = items.map((c) => c.id)
  record('historial · la fila 1 es la campaña sembrada más reciente (vol-camp-0000) y el truncado NO rompe el acceso directo a la 501', ids[0] === 'vol-camp-0000' && !ids.includes('vol-camp-0500'), `primera=${ids[0]} vol-camp-0500 en listado: ${ids.includes('vol-camp-0500')}`)

  const detalle501 = await getJson('/api/campaigns/vol-camp-0500')
  record('historial · la campaña 501 (fuera del tope) sigue accesible por detail con sus 12 eventos', detalle501.status === 200 && detalle501.json?.ok === true && detalle501.json?.events?.length === EVENTOS_POR_CAMPANA, `status=${detalle501.status} eventos=${detalle501.json?.events?.length ?? '—'}`)

  const fechas = items.map((c) => new Date(c.startedAt).getTime())
  const ordenDesc = fechas.every((f, i) => i === 0 || f <= fechas[i - 1])
  record('historial · orden startedAt desc estricto en las 500 filas', ordenDesc && fechas.length === TOPE_LISTADO, `desc=${ordenDesc}`)

  const dtoOk = items.every((c) => c.scenario?.codename && typeof c.redScore === 'number' && typeof c.blueProgress === 'number')
  record('historial · DTO íntegro en las 500 filas (scenario.codename, scores, progreso: alimenta filtros y exportación)', dtoOk, `dtoOk=${dtoOk}`)

  // Latencias repetidas
  const latLista = await cronometrar(() => getJson('/api/campaigns'), 12)
  record('historial · latencia /api/campaigns (12 iteraciones, 500 filas): p95 < 2 000 ms', latLista.ultima.status === 200 && latLista.p95 < 2_000, `p50=${latLista.p50} p95=${latLista.p95} max=${latLista.max} ms`)

  const latState = await cronometrar(() => getJson('/api/state'), 12)
  const stateItems = latState.ultima.json?.campaigns?.length ?? -1
  record('estado · /api/state sigue entregando SOLO las 15 recientes con 1 000 detrás y p95 < 1 000 ms', latState.ultima.status === 200 && stateItems === 15 && latState.p95 < 1_000, `recientes=${stateItems} p50=${latState.p50} p95=${latState.p95} max=${latState.max} ms`)

  const latDetalle = await cronometrar(() => getJson('/api/campaigns/vol-camp-0042'), 12)
  record('detalle · /api/campaigns/[id] con 12 eventos: p95 < 1 000 ms', latDetalle.ultima.status === 200 && latDetalle.p95 < 1_000, `p50=${latDetalle.p50} p95=${latDetalle.p95} max=${latDetalle.max} ms`)

  const know = await getJson('/api/knowledge')
  const kItems = know.json?.knowledge ?? []
  record('memoria · /api/knowledge entrega EXACTAMENTE 1 000 items con 1 000+ detrás (tope take:1000)', know.status === 200 && know.json?.ok === true && kItems.length === 1_000, `status=${know.status} items=${kItems.length} (${know.t} ms)`)

  // Barrido 5xx transversal
  const rutas = ['/api/campaigns', '/api/state', '/api/knowledge', '/api/campaigns/vol-camp-0000', '/api/campaigns/vol-camp-0500', '/api/campaigns/vol-camp-0999', '/api', '/historial', '/analitica', '/conocimiento']
  for (const r of rutas) {
    const resp = await get(r)
    if (resp.status >= 500) CINCO_XX.push(`${r}=${resp.status}`)
  }
  record('transversal · cero 5xx en el barrido de 10 rutas a volumen', CINCO_XX.length === 0, CINCO_XX.length ? CINCO_XX.join(' ') : 'ninguna')
}

// ═════════════════════════════════════════════════════════════
// FASE 3 — render + búsqueda con HistoryPanel REAL a 500 filas
// ═════════════════════════════════════════════════════════════

const read = (html) => ({
  contador: html.match(/>(\d+) de (\d+)</)?.slice(1).join('/') ?? '—',
  filas: [...html.matchAll(/href="\/historial\/([^"]+)"/g)].map((m) => m[1]),
  activo: [...html.matchAll(/data-active="true"[^>]*>\s*([^<]+)</g)].map((m) => m[1].trim()),
})

async function faseComponente(items) {
  const { HistoryPanel } = await import(`${ROOT}/src/components/arena/history-panel.tsx`)
  const { normalizeText } = await import(`${ROOT}/src/lib/text.ts`)

  const render = (initialResult = 'ALL', initialScenario = 'ALL') =>
    renderToStaticMarkup(createElement(HistoryPanel, { campaigns: items, initialResult, initialScenario }))

  // Render completo a 500 filas, cronometrado
  const t0 = performance.now()
  const htmlAll = render()
  const msRender = ms(t0)
  const r = read(htmlAll)
  record('render · HistoryPanel REAL con las 500 del servidor: «500 de 500» y 500 fichas enlazadas', r.contador === '500/500' && r.filas.length === TOPE_LISTADO, `contador=${r.contador} fichas=${r.filas.length} render=${msRender} ms`)

  const latRender = await cronometrar(() => render().length, 5)
  record('render · renderToStaticMarkup a 500 filas (5 iteraciones) < 2 000 ms', latRender.max < 2_000, `p50=${latRender.p50} max=${latRender.max} ms`)

  // Deep-link ?resultado=RED a volumen — esperado desde el propio DTO
  const esperadoRed = items.filter((c) => c.status === 'COMPLETED' && c.winner === 'RED').length
  const rRed = read(render('RED'))
  record('render · deep-link ?resultado=RED a volumen: contador = filtrado del DTO (siembra 400/400/200 → 200 visibles)', rRed.contador === `${esperadoRed}/500` && rRed.filas.length === esperadoRed && rRed.activo[0] === 'Gana RED', `contador=${rRed.contador} esperado=${esperadoRed} fichas=${rRed.filas.length}`)

  // Deep-link ?escenario= a volumen
  const codename = items[0]?.scenario?.codename
  const esperadoEsc = items.filter((c) => c.scenario?.codename === codename).length
  const rEsc = read(render('ALL', codename))
  record('render · deep-link ?escenario= a volumen: contador = filtrado del DTO por codename', rEsc.contador === `${esperadoEsc}/500` && rEsc.filas.length === esperadoEsc, `codename=${codename} contador=${rEsc.contador} esperado=${esperadoEsc}`)

  // Búsqueda real: el mismo pipeline del panel (normalizeText sobre
  // codename+company+industry) cronometrado sobre los 500 DTOs.
  const buscable = items.map((c) => ({ id: c.id, texto: normalizeText(`${c.scenario.codename} ${c.scenario.company} ${c.scenario.industry}`) }))
  const cuentaDe = (term) => buscable.filter((c) => c.texto.includes(term)).length

  const tB1 = performance.now()
  const hitsBanca = cuentaDe(normalizeText('Banca'))
  const msB1 = ms(tB1)
  record('búsqueda · pipeline real del panel sobre 500 DTOs: «banca» (2 escenarios de 4) — conteo determinista y < 500 ms', hitsBanca === esperadoBanca(items) && msB1 < 500, `hits=${hitsBanca} ${msB1} ms`)

  const tB2 = performance.now()
  const hitsEnergia = cuentaDe(normalizeText('energia')) // sin acento: debe encontrar «Energía»
  const msB2 = ms(tB2)
  const esperadoEnergia = cuentaDe(normalizeText('Energía'))
  record('búsqueda · término SIN acento encuentra «Energía» (normalización) y < 500 ms', hitsEnergia === esperadoEnergia && hitsEnergia > 0 && msB2 < 500, `hits=${hitsEnergia} ${msB2} ms`)
}

function esperadoBanca(items) {
  // Banca = los escenarios cuyo industry normalizado contiene «banca»
  return items.filter((c) => `${c.scenario.industry}`.toLowerCase().startsWith('banca')).length
}

// ═════════════════════════════════════════════════════════════
// FASE 4 — exportación real a volumen
// ═════════════════════════════════════════════════════════════

async function faseExportacion(items) {
  const { buildAggregateReport } = await import(`${ROOT}/src/lib/aggregate-report.ts`)
  const { buildEventsCsv, buildEventsJson } = await import(`${ROOT}/src/lib/event-export.ts`)
  const { buildKnowledgeCsv, buildKnowledgeJson } = await import(`${ROOT}/src/lib/knowledge-export.ts`)

  // Informe .md del historial (el botón del panel) con las 500 reales
  const t0 = performance.now()
  const informe = buildAggregateReport(items, 'todas las campañas')
  const msInf = ms(t0)
  const red = items.filter((c) => c.winner === 'RED').length
  const blue = items.filter((c) => c.winner === 'BLUE').length
  const draw = items.filter((c) => c.winner === 'DRAW' || c.winner === null).length
  record('exportación · buildAggregateReport (informe .md del historial) con 500 campañas reales: íntegro y < 1 000 ms', informe.length > 1_000 && informe.includes(String(TOPE_LISTADO)) && msInf < 1_000, `${informe.length} caracteres ${msInf} ms (RED=${red} BLUE=${blue} DRAW=${draw})`)

  // Detalle real de una campaña con sus 12 eventos sembrados
  const detalle = await getJson('/api/campaigns/vol-camp-0007')
  const events = detalle.json?.events ?? []
  const csvE = buildEventsCsv(events)
  record('exportación · buildEventsCsv sobre el detalle REAL: cabecera + 12 filas', csvE.trimEnd().split('\n').length === EVENTOS_POR_CAMPANA + 1, `líneas=${csvE.trimEnd().split('\n').length}`)
  const jsonE = JSON.parse(buildEventsJson(detalle.json, new Date()))
  record('exportación · buildEventsJson sobre el detalle REAL: eventos íntegros + metadatos', jsonE.ok === true && jsonE.events?.length === EVENTOS_POR_CAMPANA && !!jsonE.campaign, `eventos=${jsonE.events?.length} campaña=${jsonE.campaign?.id ?? '—'}`)

  // Memoria completa a tope: los 1 000 items DEVUELTOS por el servidor
  const know = await getJson('/api/knowledge')
  const kItems = know.json?.knowledge ?? []
  const tK = performance.now()
  const csvK = buildKnowledgeCsv(kItems)
  const msK = ms(tK)
  record('exportación · buildKnowledgeCsv con 1 000 items reales del servidor: cabecera + 1 000 filas y < 1 000 ms', csvK.trimEnd().split('\n').length === kItems.length + 1 && msK < 1_000, `líneas=${csvK.trimEnd().split('\n').length} ${msK} ms`)

  const meta = { filtersDesc: 'toda la memoria', red: kItems.filter((k) => k.team === 'RED').length, blue: kItems.filter((k) => k.team === 'BLUE').length }
  const jsonK = JSON.parse(buildKnowledgeJson(kItems, meta, new Date()))
  record('exportación · buildKnowledgeJson con 1 000 items reales: lessons íntegras + meta red/blue', jsonK.ok === true && jsonK.lessons?.length === 1_000 && jsonK.red === meta.red && jsonK.blue === meta.blue, `lessons=${jsonK.lessons?.length} red=${jsonK.red} blue=${jsonK.blue}`)
}

// ═════════════════════════════════════════════════════════════
// PRINCIPAL
// ═════════════════════════════════════════════════════════════

const conteos = await sembrar()
if (!conteos) process.exit(1)
if (!(await construir())) process.exit(1)

const inst = await arrancarServidor()

const lista = await getJson('/api/campaigns')
const items = lista.json?.campaigns ?? []

try {
  await faseHistorial()
  await faseComponente(items)
  await faseExportacion(items)
} finally {
  inst.server.kill('SIGTERM')
  await sleep(2_000)
  if (inst.server.pid && sigueVivo(inst.server.pid)) {
    try { process.kill(inst.server.pid, 'SIGKILL') } catch { /* ya muerto */ }
    await sleep(500)
  }
  record('apagado · proceso del standalone terminado de verdad (PID signal-0)', !inst.server.pid || !sigueVivo(inst.server.pid), `pid=${inst.server.pid ?? '—'}`)
}

const fallos = results.filter((r) => !r.ok)
console.log(`\n${results.length - fallos.length}/${results.length} OK — e2e-volumen (sembradas ${conteos.campañas} campañas, ${conteos.eventos} eventos)`)
if (fallos.length) {
  console.log('FALLOS:')
  for (const f of fallos) console.log(` · ${f.name}`)
  process.exit(1)
}
