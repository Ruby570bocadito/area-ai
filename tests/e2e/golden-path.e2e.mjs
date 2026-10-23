#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-golden-path — agente TEST (protocolo v2)
//
//   bun tests/e2e/golden-path.e2e.mjs
//
// Recorre el camino dorado de un usuario real sobre una BD propia
// y un servidor de producción standalone (no toca db/custom.db):
//   (1) prisma db push sobre BD dedicada
//   (2) arranque del standalone (construye si falta)
//   (3) healthcheck /api, seed en /api/state, páginas principales
//   (4) lanzamiento de campaña real y espera a su fin
//   (5) ficha con eventos y comandos reales, lecciones archivadas,
//       progreso en escala cerrada [0,100] y engineMode presente
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PORT = Number(process.env.E2E_PORT || 3115)
const LAB_PORT = Number(process.env.E2E_LAB_PORT || 4415)
const DB_PATH = process.env.E2E_DB || `${ROOT}/db/e2e-golden.db`
const BASE = `http://127.0.0.1:${PORT}`
const TIMEOUT_S = Number(process.env.E2E_CAMPAIGN_TIMEOUT || 300)
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

const inScale = (v) => Number.isFinite(v) && v >= 0 && v <= 100

// ── (1) BD dedicada ──────────────────────────────────────────
const push = spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: 'pipe',
  encoding: 'utf8',
})
record('prisma db push (BD dedicada)', push.status === 0, push.status === 0 ? DB_PATH : push.stderr.slice(-300))

// ── (2) standalone ───────────────────────────────────────────
const serverJs = resolve(ROOT, '.next/standalone/server.js')
if (!existsSync(serverJs)) {
  console.log('standalone ausente: construyendo (next build + assets)…')
  const built = spawnSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  if (built.status === 0) {
    cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
    cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })
  }
  record('build de producción', built.status === 0)
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
record('servidor standalone responde', up, up ? BASE : `no arrancó en 30s\n${serverLog.slice(-500)}`)

if (up) {
  // ── (3) golden path de lectura ─────────────────────────────
  const health = await fetch(`${BASE}/api`).then((r) => r.json()).catch(() => null)
  record('healthcheck /api con BD up', health?.ok === true && health?.db === 'up')

  const state = await fetch(`${BASE}/api/state`).then((r) => r.json()).catch(() => null)
  record(
    'seed: ≥10 agentes y ≥6 escenarios',
    Array.isArray(state?.agents) && state.agents.length >= 10 && Array.isArray(state?.scenarios) && state.scenarios.length >= 6,
    state ? `agentes=${state.agents.length} escenarios=${state.scenarios.length}` : 'sin respuesta'
  )

  for (const page of ['/', '/arena', '/historial', '/analitica']) {
    const res = await fetch(`${BASE}${page}`).catch(() => null)
    record(`página ${page}`, res?.status === 200, `HTTP ${res?.status ?? 'sin respuesta'}`)
  }

  // ── (4) campaña real ───────────────────────────────────────
  const launch = await fetch(`${BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }).then((r) => r.json().catch(() => null)).catch(() => null)
  const id = launch?.campaignId
  record('POST /api/campaigns', launch?.ok === true && !!id, `campaña ${id ?? 'ninguna'}`)

  if (id) {
    const deadline = Date.now() + TIMEOUT_S * 1000
    let detail = null
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await fetch(`${BASE}/api/campaigns/${id}`).then((r) => r.json()).catch(() => null)
      if (res?.ok && res.campaign?.status !== 'RUNNING') { detail = res; break }
    }

    record('campaña COMPLETED', detail?.campaign?.status === 'COMPLETED',
      detail ? `estado ${detail.campaign.status} · motor ${detail.campaign.engineMode ?? '?'}` : `timeout ${TIMEOUT_S}s`)

    const events = Array.isArray(detail?.events) ? detail.events : []
    const withCommand = events.filter((e) => typeof e.command === 'string' && e.command.trim() !== '').length
    record('eventos con comando real (materia de exportación CSV)', events.length > 0 && withCommand > 0, `eventos=${events.length} con comando=${withCommand}`)

    record('ganador válido y progreso en escala cerrada [0,100]',
      ['RED', 'BLUE', 'DRAW'].includes(detail?.campaign?.winner) &&
        inScale(detail?.campaign?.redProgress) && inScale(detail?.campaign?.blueProgress),
      detail ? `${detail.campaign.redProgress}/${detail.campaign.blueProgress} ganador ${detail.campaign.winner}` : 'sin ficha')

    const k = await fetch(`${BASE}/api/knowledge`).then((r) => r.json()).catch(() => null)
    const lessons = Array.isArray(k?.knowledge) ? k.knowledge.filter((x) => x.campaignId === id) : []
    record('lecciones archivadas en la memoria (≥2)', lessons.length >= 2, `lecciones=${lessons.length}`)

    record('engineMode presente en ficha (trazabilidad de degradación)', typeof detail?.campaign?.engineMode === 'string' && detail.campaign.engineMode !== '', `motor=${detail?.campaign?.engineMode ?? 'ausente'}`)
  }
}

server.kill('SIGTERM')
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
if (failed.length > 0) { console.log('FALLOS: ' + failed.map((f) => f.name).join(' | ')); process.exit(1) }
process.exit(0)
