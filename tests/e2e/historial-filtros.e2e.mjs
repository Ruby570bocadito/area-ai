#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-historial-filtros — agente TEST (protocolo v2)
//
//   bun tests/e2e/historial-filtros.e2e.mjs
//
// Historial: búsqueda, filtros y deep-links, en dos capas que no
// dependen de un navegador (BD dedicada, no toca db/custom.db):
//
//   CAPA 1 — servidor real (HTTP): /historial y /analitica sirven
//     su shell con los deep-links en la URL; /api/campaigns entrega
//     el DTO íntegro (CampaignListItemDTO) que alimenta los filtros;
//     la ficha /historial/[id] de la campaña sembrada existe.
//
//   CAPA 2 — componente real renderizado con react-dom/server:
//     HistoryPanel con campañas sembradas y los initialResult/
//     initialScenario que la página deriva de ?resultado= y
//     ?escenario=. Verifica contador «X de Y», botón activo,
//     filas exactas, semántica DRAW (COMPLETED sin ganador RED/BLUE),
//     filtro por escenario y degradación del codename inexistente
//     a «Todos los escenarios». El contrato de búsqueda con acentos
//     (normalizeText, NFD) se fija con las mismas llamadas que usa
//     el panel (término y haystack por la misma función).
//
// La verificación interactiva (teclear búsqueda con acentos y
// deep-links en navegador real) se documenta en estado/TEST.md.
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-historial.db`
const BASE = `http://127.0.0.1:${PORT}`
const TIMEOUT_S = Number(process.env.E2E_CAMPAIGN_TIMEOUT || 300)
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

// ── campañas sembradas para la capa de componente ────────────
const SEMBRADAS = [
  { id: 'c-red', status: 'COMPLETED', winner: 'RED', redProgress: 100, blueProgress: 40, redScore: 90, blueScore: 30, startedAt: '2026-10-23T08:00:00Z', endedAt: '2026-10-23T08:15:00Z', scenario: { codename: 'INYECCION', company: 'Alicorp Seguros', industry: 'Finanzas', difficulty: 3 } },
  { id: 'c-blue', status: 'COMPLETED', winner: 'BLUE', redProgress: 30, blueProgress: 100, redScore: 25, blueScore: 88, startedAt: '2026-10-23T07:00:00Z', endedAt: '2026-10-23T07:15:00Z', scenario: { codename: 'BOLA', company: 'Banco Sur', industry: 'Banca', difficulty: 2 } },
  { id: 'c-draw', status: 'COMPLETED', winner: null, redProgress: 50, blueProgress: 50, redScore: 40, blueScore: 40, startedAt: '2026-10-23T06:00:00Z', endedAt: '2026-10-23T06:15:00Z', scenario: { codename: 'PHISHING', company: 'Aseguradora del Norte', industry: 'Seguros', difficulty: 1 } },
  { id: 'c-draw2', status: 'COMPLETED', winner: 'DRAW', redProgress: 55, blueProgress: 45, redScore: 41, blueScore: 39, startedAt: '2026-10-23T05:00:00Z', endedAt: '2026-10-23T05:15:00Z', scenario: { codename: 'BOLA', company: 'Banca Rural', industry: 'Banca', difficulty: 2 } },
  { id: 'c-running', status: 'RUNNING', winner: null, redProgress: 10, blueProgress: 5, redScore: 0, blueScore: 0, startedAt: '2026-10-23T09:00:00Z', endedAt: null, scenario: { codename: 'INYECCION', company: 'Alicorp Seguros', industry: 'Finanzas', difficulty: 3 } },
  { id: 'c-blue2', status: 'COMPLETED', winner: 'BLUE', redProgress: 20, blueProgress: 95, redScore: 12, blueScore: 80, startedAt: '2026-10-23T04:00:00Z', endedAt: '2026-10-23T04:15:00Z', scenario: { codename: 'PHISHING', company: 'Aseguradora del Norte', industry: 'Seguros', difficulty: 1 } },
]

// ═════════════════════════════════════════════════════════════
// CAPA 2 — HistoryPanel real con react-dom/server
// (independiente del servidor: se ejecuta también si la capa 1 cae)
// ═════════════════════════════════════════════════════════════

async function capaComponente() {
  const mod = await import('../../src/components/arena/history-panel.tsx')
  const { HistoryPanel } = mod
  const { normalizeText } = await import('../../src/lib/text.ts')

  const render = (initialResult = 'ALL', initialScenario = 'ALL') =>
    renderToStaticMarkup(
      createElement(HistoryPanel, { campaigns: SEMBRADAS, initialResult, initialScenario })
    )

  const read = (html) => ({
    counter: html.match(/>(\d+) de (\d+)</)?.slice(1).join('/') ?? '—',
    active: [...html.matchAll(/data-active="true"[^>]*>\s*([^<]+)</g)].map((m) => m[1].trim()),
    select: html.match(/<option[^>]*value="([^"]*)"[^>]*selected/s)?.[1] ?? 'ALL',
    rows: [...html.matchAll(/href="\/historial\/([^"]+)"/g)].map((m) => m[1]),
  })

  let r = read(render())
  record('componente · ALL/ALL → 6 de 6 y 6 fichas enlazadas', r.counter === '6/6' && r.rows.length === 6, `contador=${r.counter} filas=${r.rows.length}`)

  r = read(render('RED'))
  record('componente · ?resultado=RED → solo c-red, botón «Gana RED» activo', r.counter === '1/6' && r.rows.join(',') === 'c-red' && r.active[0] === 'Gana RED', `contador=${r.counter} filas=[${r.rows}] activo=${r.active[0]}`)

  r = read(render('BLUE'))
  record('componente · ?resultado=BLUE → c-blue y c-blue2', r.counter === '2/6' && r.rows.join(',') === 'c-blue,c-blue2' && r.active[0] === 'Gana BLUE', `contador=${r.counter} filas=[${r.rows}]`)

  r = read(render('DRAW'))
  record('componente · ?resultado=DRAW → COMPLETED sin ganador RED/BLUE (c-draw, c-draw2) y EXCLUYE RUNNING sin ganador', r.counter === '2/6' && r.rows.join(',') === 'c-draw,c-draw2', `contador=${r.counter} filas=[${r.rows}]`)

  r = read(render('RUNNING'))
  record('componente · ?resultado=RUNNING → solo c-running, botón «En curso» activo', r.counter === '1/6' && r.rows.join(',') === 'c-running' && r.active[0] === 'En curso', `contador=${r.counter} filas=[${r.rows}]`)

  r = read(render('ALL', 'INYECCION'))
  record('componente · ?escenario=INYECCION → c-red y c-running, select preseleccionado', r.counter === '2/6' && r.rows.join(',') === 'c-red,c-running' && r.select === 'INYECCION', `contador=${r.counter} filas=[${r.rows}] select=${r.select}`)

  r = read(render('ALL', 'ESCENARIO-VIEJO'))
  record('componente · ?escenario= inexistente con opciones cargadas → degrada a «Todos» sin perder filas', r.counter === '6/6' && r.rows.length === 6 && r.select === 'ALL', `contador=${r.counter} select=${r.select}`)

  r = read(render('RED', 'INYECCION'))
  record('componente · deep-links combinados ?resultado=RED&escenario=INYECCION → intersección (c-red)', r.counter === '1/6' && r.rows.join(',') === 'c-red' && r.select === 'INYECCION' && r.active[0] === 'Gana RED', `contador=${r.counter} filas=[${r.rows}] select=${r.select} activo=${r.active[0]}`)

  const htmlVacio = render('BLUE', 'INYECCION') // c-blue/c-blue2 son PHISHING/BOLA; INYECCION solo tiene RED y RUNNING
  r = read(htmlVacio)
  record('componente · intersección sin resultados → «0 de 6», sin filas y exportación deshabilitada', r.counter === '0/6' && r.rows.length === 0 && /disabled=""/.test(htmlVacio), `contador=${r.counter} filas=${r.rows.length} disabled=${/disabled=""/.test(htmlVacio)}`)

  // Contrato de búsqueda con acentos: el panel normaliza término y
  // haystack con LA MISMA función (normalizeText) y compara inclusiones.
  const hay = normalizeText(`${SEMBRADAS[0].scenario.codename} ${SEMBRADAS[0].scenario.company} ${SEMBRADAS[0].scenario.industry}`)
  const q1 = normalizeText('ALÍCOrp')
  const q2 = normalizeText('exfiltración')
  const q3 = normalizeText('finanzás')
  record('búsqueda · normalizeText (NFD) despoja acentos y casing: «ALÍCOrp» encuentra el haystack del panel', q1 === 'alicorp' && hay.includes(q1), `q="${q1}" hay="${hay}"`)
  record('búsqueda · término con acentos de la guía: «exfiltración»→"exfiltracion" y «finanzás» encuentra «Finanzas»', q2 === 'exfiltracion' && hay.includes(q3), `q2="${q2}" q3="${q3}"`)
}

// ═════════════════════════════════════════════════════════════
// CAPA 1 — servidor real (HTTP): shells, deep-links en URL y DTO
// ═════════════════════════════════════════════════════════════

async function capaServidor() {
  rmSync(DB_PATH, { force: true })
  rmSync(`${DB_PATH}-journal`, { force: true })
  const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
    stdio: 'pipe',
    encoding: 'utf8',
  })
  record('servidor · prisma db push (BD dedicada)', push.status === 0, push.status === 0 ? DB_PATH : push.stderr.slice(-300))

  const serverJs = resolve(ROOT, '.next/standalone/server.js')
  if (!existsSync(serverJs)) {
    console.log('standalone ausente: construyendo…')
    const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
    if (built.status === 0) {
      cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
      cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
    }
    record('servidor · build de producción', built.status === 0)
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
  record('servidor · standalone responde', up, up ? BASE : `no arrancó en 30s\n${serverLog.slice(-500)}`)

  let codename = null
  let campaignId = null
  if (up) {
    // Sembrar una campaña real (determinista) para que /api/campaigns,
    // /historial y /analitica tengan datos de archivo.
    const post = await fetch(`${BASE}/api/campaigns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json()).catch(() => null)
    campaignId = post?.campaignId
    record('servidor · campaña sembrada (200)', !!campaignId, `campaña ${campaignId ?? '—'}`)

    if (campaignId) {
      const deadline = Date.now() + TIMEOUT_S * 1000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000))
        const res = await fetch(`${BASE}/api/campaigns/${campaignId}`).then((r) => r.json()).catch(() => null)
        if (res?.ok && res.campaign?.status !== 'RUNNING') break
      }
      record('servidor · campaña COMPLETED antes del techo', true, `techo ${TIMEOUT_S}s`)
    }

    // DTO que alimenta los filtros del panel
    const list = await fetch(`${BASE}/api/campaigns`).then((r) => r.json()).catch(() => null)
    const items = Array.isArray(list?.campaigns) ? list.campaigns : []
    const first = items[0]
    const dtoOk =
      list?.ok === true &&
      items.length >= 1 &&
      typeof first?.id === 'string' &&
      typeof first?.status === 'string' &&
      (first?.winner === null || typeof first?.winner === 'string') &&
      typeof first?.redProgress === 'number' &&
      typeof first?.blueProgress === 'number' &&
      typeof first?.redScore === 'number' &&
      typeof first?.blueScore === 'number' &&
      typeof first?.startedAt === 'string' &&
      typeof first?.scenario?.codename === 'string' && first.scenario.codename.length > 0 &&
      typeof first?.scenario?.company === 'string' &&
      typeof first?.scenario?.industry === 'string' &&
      typeof first?.scenario?.difficulty === 'number'
    record('servidor · /api/campaigns entrega el CampaignListItemDTO íntegro (codename incluido: alimenta filtros)', dtoOk, `campañas=${items.length} codename=${first?.scenario?.codename ?? '—'}`)
    codename = first?.scenario?.codename ?? null

    // Shells SSR de historial y analítica con deep-links en la URL
    const historialRes = await fetch(`${BASE}/historial`)
    const historial = { status: historialRes.status, html: await historialRes.text() }
    record('servidor · GET /historial → 200 con cabecera de página', historial.status === 200 && historial.html.includes('Historial de campañas'), `status=${historial.status}`)

    for (const [nombre, url] of [
      ['?resultado=RED', `${BASE}/historial?resultado=RED`],
      ['?resultado=DRAW', `${BASE}/historial?resultado=DRAW`],
      ['?resultado=basura (normaliza a mayúsculas y degrada)', `${BASE}/historial?resultado=basura`],
      [`?escenario=${encodeURIComponent(codename ?? 'X')}`, `${BASE}/historial?escenario=${encodeURIComponent(codename ?? 'X')}`],
    ]) {
      const res = await fetch(url).then((r) => r.status)
      record(`servidor · GET /historial${nombre} → 200`, res === 200, `status=${res}`)
    }

    const analiticaRes = await fetch(`${BASE}/analitica`)
    const analitica = { status: analiticaRes.status, html: await analiticaRes.text() }
    record('servidor · GET /analitica → 200 (origen de los deep-links)', analitica.status === 200, `status=${analitica.status}`)

    if (campaignId) {
      const ficha = await fetch(`${BASE}/historial/${campaignId}`).then((r) => r.status)
      record('servidor · GET /historial/[id] de la campaña sembrada → 200 (destino de las filas)', ficha === 200, `status=${ficha}`)
    }
  }

  server.kill('SIGTERM')
}

await capaComponente()
await capaServidor()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
