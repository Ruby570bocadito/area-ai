#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-exportaciones — agente TEST (protocolo v2)
//
//   bun tests/e2e/exportaciones.e2e.mjs
//
// Exportaciones CSV/JSON/.md en dos capas (BD dedicada, no toca
// db/custom.db):
//
//   CAPA 1 — servidor real (HTTP): campaña determinista sembrada;
//     el detalle (/api/campaigns/[id]) entrega events+knowledge;
//     consistencia listado ↔ detalle ↔ ficha (/historial/[id]).
//
//   CAPA 2 — los tres exportadores REALES (los mismos módulos que
//     descarga la UI) ejecutados con los datos reales del servidor:
//       · Telemetría: buildEventsCsv / buildEventsJson
//       · Memoria:    buildKnowledgeCsv / buildKnowledgeJson
//       · Informe:    buildAggregateReport (Markdown)
//     BOM UTF-8, dialecto «;» (es-ES), columnas exactas, campos
//     derivados (tasa de éxito, confianza %, tags normalizados,
//     recuentos del informe) y redondeos.
//
//   CELDAS PELIGROSAS: vectores de inyección de fórmula (= + - @ \t \r)
//     sobre csvEscapeCell (fuente única compartida) y a través del
//     pipeline completo de los dos exportadores CSV con una lección y
//     un evento envenenados sintéticos (la UI no puede sembrar datos
//     peligrosos vía API: los escenarios son del catálogo).
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-export.db`
const BASE = `http://127.0.0.1:${PORT}`
const TIMEOUT_S = Number(process.env.E2E_CAMPAIGN_TIMEOUT || 300)
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

// ── módulos reales de exportación (los mismos que descarga la UI) ──
const { buildEventsCsv, buildEventsJson, EVENTS_CSV_HEADERS } = await import('../../src/lib/event-export.ts')
const { buildKnowledgeCsv, buildKnowledgeJson, KNOWLEDGE_CSV_HEADERS } = await import('../../src/lib/knowledge-export.ts')
const { buildAggregateReport } = await import('../../src/lib/aggregate-report.ts')
const { csvEscapeCell, exportFilename } = await import('../../src/lib/text.ts')

// Mini-parser RFC 4180 (separador «;», comillas dobladas, celdas multilínea)
// para validar los CSV como los leería Excel o un reimportador real.
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  let i = 0
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  while (i < s.length) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i += 2 }
      else if (ch === '"') { quoted = false; i += 1 }
      else { cell += ch; i += 1 }
    } else if (ch === '"' && cell === '') { quoted = true; i += 1 }
    else if (ch === ';') { row.push(cell); cell = ''; i += 1 }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1 }
    else { cell += ch; i += 1 }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows
}

// ═════════════════════════════════════════════════════════════
// CELDAS PELIGROSAS — vectores directos y pipeline completo
// ═════════════════════════════════════════════════════════════

function celdasPeligrosas() {
  const vectores = [
    ['=cmd|\' /C calc!\'', "'" + '=cmd|\' /C calc!\''],
    ['=HYPERLINK("http://evil","ganar")', '"' + "'" + '=HYPERLINK(""http://evil"",""ganar"")"'],
    ['+SUM(A1:A9)', "'+SUM(A1:A9)"],
    ['-2+3+ payroll', "'-2+3+ payroll"],
    ['@SUM(1)', "'@SUM(1)"],
    ['\tx', "'\tx"],
    ['\rcomando', "'\rcomando"],
  ]
  let ok = true
  for (const [input, expected] of vectores) {
    if (csvEscapeCell(input) !== expected) { ok = false; break }
  }
  record('csv · csvEscapeCell neutraliza los 7 vectores de fórmula (= + - @ TAB CR) con prefijo apóstrofe', ok, `último caso: ${JSON.stringify(csvEscapeCell(vectores[6][0]))}`)

  record('csv · celda con «;» o comillas → envuelta en comillas y comillas dobladas (RFC 4180)',
    csvEscapeCell('a;b') === '"a;b"' && csvEscapeCell('dice "hola"') === '"dice ""hola"""',
    `${JSON.stringify(csvEscapeCell('a;b'))} ${JSON.stringify(csvEscapeCell('dice "hola"'))}`)

  record('csv · celda inocua pasa intacta (sin escapado innecesario)', csvEscapeCell('Operación Púlsar') === 'Operación Púlsar', '')

  // Pipeline completo: lección envenenada a través de buildKnowledgeCsv
  const venenosa = [{
    team: 'RED', category: 'LECCION',
    title: '=HYPERLINK("http://evil","pulsa")',
    content: 'línea1\nlínea2; con "comillas" y ;puntos',
    tags: '=cmd,a,b', confidence: 0.5, timesUsed: 2, timesWorked: 1,
    agentCodename: null, campaignId: 'x', campaignCodename: 'CAMP;A', createdAt: '2026-10-23T10:00:00Z',
  }]
  const csvK = buildKnowledgeCsv(venenosa)
  const filasK = parseCsv(csvK)
  record('csv · lección envenenada vía buildKnowledgeCsv → 2 registros RFC-4180 (el \n citado no rompe filas)', filasK.length === 2 && filasK[0].length === 12 && filasK[1].length === 12, `registros=${filasK.length} celdas=${filasK[1]?.length}`)
  record('csv · round-trip del reimportador: título saneado (apóstrofe incluido), contenido multilínea y escenario con «;» íntegros', filasK[1][2] === "'" + venenosa[0].title && filasK[1][3] === venenosa[0].content && filasK[1][10] === 'CAMP;A', `título=${JSON.stringify(filasK[1][2]?.slice(0, 30))}`)
  record('csv · inyección de fórmula neutralizada en el pipeline real: título y tags llevan prefijo apóstrofe', filasK[1][2].startsWith("'") && filasK[1][4].startsWith("'"), `tags=${JSON.stringify(filasK[1][4])}`)
  record('csv · BOM UTF-8 presente en el exportador de memoria (Excel respeta acentos)', csvK.charCodeAt(0) === 0xfeff, '')

  // Pipeline completo: evento envenenado a través de buildEventsCsv
  const eventoVenenoso = [{
    id: 'e1', seq: 1, round: 1, phase: 'RECON', team: 'RED', agentKey: 'a1', agentCodename: '@agente',
    action: '=SUM(1)', result: 'OK', impact: 'BAJO', severity: 'INFO', targetNode: 'web;app',
    command: 'curl\tpoison', detail: 'detalle con "comillas"', createdAt: '2026-10-23T10:00:00Z',
  }]
  const csvE = buildEventsCsv(eventoVenenoso)
  const filasE = parseCsv(csvE)
  record('csv · evento envenenado vía buildEventsCsv → 2 registros, round-trip íntegro y fórmula neutralizada', filasE.length === 2 && filasE[1][4] === "'@agente" && filasE[1][5].startsWith("'") && filasE[1][10] === 'curl\tpoison', `registros=${filasE.length} acción=${JSON.stringify(filasE[1][5])}`)

  // Nombres de fichero
  const fname = exportFilename('campanas', 'csv')
  record('csv · exportFilename con marca temporal y sin espacios', /^area-ai-campanas-\d{8}-\d{4}\.csv$/.test(fname), fname)
}

// ═════════════════════════════════════════════════════════════
// CAPA 1 — servidor real + CAPA 2 con sus datos
// ═════════════════════════════════════════════════════════════

async function servidorYExportadores() {
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

  if (up) {
    // Sembrar campaña determinista y esperar su fin
    const post = await fetch(`${BASE}/api/campaigns`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }).then((r) => r.json()).catch(() => null)
    const id = post?.campaignId
    record('servidor · campaña sembrada (200)', !!id, `campaña ${id ?? '—'}`)

    if (id) {
      const deadline = Date.now() + TIMEOUT_S * 1000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000))
        const res = await fetch(`${BASE}/api/campaigns/${id}`).then((r) => r.json()).catch(() => null)
        if (res?.ok && res.campaign?.status !== 'RUNNING') break
      }
    }

    // ── los tres orígenes de datos de la UI ──────────────────
    const list = await fetch(`${BASE}/api/campaigns`).then((r) => r.json()).catch(() => null)
    const items = Array.isArray(list?.campaigns) ? list.campaigns : []
    const detail = await fetch(`${BASE}/api/campaigns/${id}`).then((r) => r.json()).catch(() => null)
    const knowledgeAll = await fetch(`${BASE}/api/knowledge`).then((r) => r.json()).catch(() => null)
    record('servidor · listado, detalle y /api/knowledge disponibles', items.length >= 1 && detail?.ok === true && Array.isArray(detail.events) && Array.isArray(detail.knowledge) && knowledgeAll?.ok === true, `campañas=${items.length} eventos=${detail?.events?.length ?? '—'} conocimiento=${detail?.knowledge?.length ?? '—'}`)

    if (items.length >= 1 && detail?.ok) {
      const ficha = await fetch(`${BASE}/historial/${id}`).then((r) => r.status)
      record('servidor · ficha /historial/[id] → 200', ficha === 200, `status=${ficha}`)

      // ── consistencia listado ↔ detalle ↔ ficha ────────────
      const row = items.find((c) => c.id === id)
      const c = detail.campaign
      const consistente = row && c &&
        row.status === c.status && row.winner === c.winner &&
        row.redScore === c.redScore && row.blueScore === c.blueScore &&
        row.redProgress === c.redProgress && row.blueProgress === c.blueProgress &&
        row.scenario.codename === c.scenario.codename &&
        typeof c.engineMode === 'string'
      record('consistencia · listado ↔ detalle: mismo estado, ganador, puntos, progresos y escenario', !!consistente, `status=${row?.status}/${c?.status} winner=${row?.winner}/${c?.winner} puntos=${row?.redScore}-${row?.blueScore}/${c?.redScore}-${c?.blueScore}`)
    }

    // ── CAPA 2: exportadores REALES con datos reales ─────────
    if (detail?.ok) {
      // Telemetría CSV
      const csvE = buildEventsCsv(detail.events)
      const lineas = csvE.split('\n')
      const header = lineas[0].replace(/^\uFEFF/, '').split(';')
      record('telemetría · buildEventsCsv: BOM + 12 columnas exactas en el orden del contrato', csvE.charCodeAt(0) === 0xfeff && JSON.stringify(header) === JSON.stringify(EVENTS_CSV_HEADERS), header.join(','))
      record('telemetría · una fila por evento en orden seq ascendente', lineas.length - 1 === detail.events.length && detail.events.every((e, i) => i === 0 || e.seq >= detail.events[i - 1].seq), `filas=${lineas.length - 1}/${detail.events.length}`)

      // Telemetría JSON
      const jsonE = JSON.parse(buildEventsJson(detail))
      record('telemetría · buildEventsJson reimportable: eventos íntegros + metadatos de campaña arriba', jsonE.ok === true && Array.isArray(jsonE.events) && jsonE.events.length === detail.events.length && typeof jsonE.exportedAt === 'string' && !Number.isNaN(Date.parse(jsonE.exportedAt)) && !!jsonE.campaign?.codename, `eventos=${jsonE.events?.length} exportedAt=${jsonE.exportedAt}`)

      // Memoria CSV (lecciones de la campaña sembrada; puede venir vacía)
      const lecciones = detail.knowledge ?? []
      const csvK = buildKnowledgeCsv(lecciones)
      const headerK = csvK.split('\n')[0].replace(/^\uFEFF/, '').split(';')
      record('memoria · buildKnowledgeCsv: BOM + cabecera del contrato (vacía → solo cabecera, sin crash)', csvK.charCodeAt(0) === 0xfeff && JSON.stringify(headerK) === JSON.stringify(KNOWLEDGE_CSV_HEADERS), `lecciones=${lecciones.length} cabecera=${headerK.length} cols`)

      // Confianza % y tasa derivada con una lección sintética de control
      const control = [{ team: 'BLUE', category: 'TACTICA', title: 't', content: 'c', tags: 'a, b,,c', confidence: 0.678, timesUsed: 3, timesWorked: 2, agentCodename: 'AG', campaignId: id, campaignCodename: 'X', createdAt: '2026-10-23T10:00:00Z' }]
      const csvControl = buildKnowledgeCsv(control).split('\n')[1].split(';')
      record('memoria · campos derivados: confianza 0.678 → 68%, tasa 2/3 → 67%, tags tal cual (el JSON los normaliza)', csvControl[5] === '68' && csvControl[8] === '67', `confianza=${csvControl[5]} tasa=${csvControl[8]}`)

      const jsonK = JSON.parse(buildKnowledgeJson(control, { filtersDesc: 'ninguno', red: 0, blue: 1 }))
      const lesson = jsonK.lessons[0]
      record('memoria · buildKnowledgeJson: tags «a, b,,c» → lista limpia [a,b,c], confidence 0.678 → 0.68, successRate 67', JSON.stringify(lesson.tags) === '["a","b","c"]' && lesson.confidence === 0.68 && lesson.successRate === 67, `tags=${JSON.stringify(lesson.tags)} conf=${lesson.confidence} tasa=${lesson.successRate}`)

      // Informe agregado .md con el listado real
      const md = buildAggregateReport(items, 'ninguno (archivo completo)')
      const completed = items.filter((x) => x.status === 'COMPLETED')
      const empates = completed.filter((x) => x.winner !== 'RED' && x.winner !== 'BLUE').length
      record('informe · buildAggregateReport: cabecera, campañas incluidas y empates consistentes con el listado real', md.startsWith('# Informe agregado del archivo — area·ai') && md.includes(`| Campañas incluidas | ${items.length} |`) && md.includes(`| Empates | ${empates} (${completed.length > 0 ? Math.round((empates / completed.length) * 1000) / 10 : '—'}%) |`), `campañas=${items.length} empates=${empates}`)
      record('informe · filtros aplicados y pie de generación presentes', md.includes('**Filtros aplicados:** ninguno (archivo completo)') && md.includes('Generado por area·ai') && md.trimEnd().endsWith('laboratorio adversarial de agentes IA.'), '')
      const codenameReal = items[0].scenario.codename
      record('informe · escenario más frecuente = codename real del listado', md.includes(codenameReal), `codename=${codenameReal}`)
    }
  }

  server.kill('SIGTERM')
}

celdasPeligrosas()
await servidorYExportadores()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
