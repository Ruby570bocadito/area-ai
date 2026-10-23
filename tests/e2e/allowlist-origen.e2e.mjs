#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// e2e-allowlist-origen — agente SEG (tarea allowlist-e2e-standalone)
//
//   bun tests/e2e/allowlist-origen.e2e.mjs
//
// La allowlist de origen de isSameOrigin (origin-allowlist-env, 407c7aa)
// acepta un Origin cuyo host coincide con NEXT_PUBLIC_SITE_URL para
// despliegues tras proxies que reescriben el Host. Hoy solo la cubren
// unit tests con Headers fabricados; esta suite ejercita el CAMINO REAL:
// standalone de producción (Next) + POST /api/settings + barra same-origin,
// con tres instancias efímeras en el puerto SEG 3113 (secuenciales, muerte
// verificada) y BD propia por instancia (db push sobre .agent-tmp, sin
// tocar db/custom.db):
//
//   E1 · control SIN la variable — Origin de otro host → 403; sin Origin
//        → 200 (la barrera existe y el endpoint funciona).
//   E2 · CON NEXT_PUBLIC_SITE_URL=https://panel.example — Origin del sitio
//        → 200 (atraviesa la allowlist aunque el Host sea 127.0.0.1);
//        Origin de otro host → 403 (la allowlist no abre la puerta a
//        cualquiera).
//   E3 · CON la variable MALFORMADA («no-es-una-url») — Origin del
//        «sitio» → 403 (una URL de sitio malformada NO relaja nada);
//        sin Origin → 200 (el endpoint sigue vivo).
//
// Sonda: POST /api/settings — primera barrera same-origin ANTES de token
// y bucket (orden canónico 403→429→401→413): un 403 delata bloqueo del
// Origin; un 200 (modo local abierto R4, sin ADMIN_TOKEN) delata paso.
//
// Exit 0 = todo verde.
// ─────────────────────────────────────────────────────────────

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const STANDALONE = resolve(ROOT, '.next/standalone/server.js')
const PORT = 3113 // puerto SEG (OWNERSHIP/PROTOCOLO §6)
const BASE = `http://127.0.0.1:${PORT}`
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ` · ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const sigueVivo = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function prepararDB(dbPath) {
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-journal`, { force: true })
  spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'pipe',
    encoding: 'utf8',
  })
}

function iniciar(dbPath, extraEnv = {}) {
  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
    PORT: String(PORT),
    NODE_ENV: 'production',
    ...extraEnv,
  }
  const server = spawn('bun', [STANDALONE], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  server.stdout.on('data', (d) => (log += d))
  server.stderr.on('data', (d) => (log += d))
  return { server, log: () => log }
}

async function matar(instancia, etiqueta) {
  instancia.server.kill('SIGTERM')
  await sleep(2_000)
  if (instancia.server.pid && sigueVivo(instancia.server.pid)) {
    try {
      process.kill(instancia.server.pid, 'SIGKILL')
    } catch {
      /* ya muerto */
    }
    await sleep(500)
  }
  record(`apagado · ${etiqueta}: proceso terminado de verdad`, !instancia.server.pid || !sigueVivo(instancia.server.pid), `pid=${instancia.server.pid ?? '—'}`)
}

async function esperarArranque(maxMs = 20_000) {
  const fin = Date.now() + maxMs
  while (Date.now() < fin) {
    const up = await fetch(`${BASE}/`).then((r) => r.status).catch(() => null)
    if (up !== null) return up
    await sleep(500)
  }
  return null
}

/** POST /api/settings con Origin opcional; devuelve el status. */
async function probe(origin) {
  const headers = { 'content-type': 'application/json' }
  if (origin !== undefined) headers.origin = origin
  const res = await fetch(`${BASE}/api/settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ baseUrl: 'https://proveedor.example', apiKey: 'sk-e2e', model: 'm-e2e' }),
  }).catch(() => null)
  return res ? res.status : null
}

async function instancia(etiqueta, dbPath, extraEnv) {
  prepararDB(dbPath)
  const instancia = iniciar(dbPath, extraEnv)
  const up = await esperarArranque()
  record(`arranque · ${etiqueta}: portada responde`, up === 200, `status=${up ?? 'sin respuesta'}`)
  return instancia
}

// Assets del standalone (mismo requisito que el arnés de TEST)
cpSync(resolve(ROOT, '.next/static'), resolve(ROOT, '.next/standalone/.next/static'), { recursive: true })
cpSync(resolve(ROOT, 'public'), resolve(ROOT, '.next/standalone/public'), { recursive: true })

// ── E1: control sin la variable ────────────────────────────────
{
  const db = resolve(ROOT, '.agent-tmp/allowlist-e1.db')
  const inst = await instancia('E1 sin variable', db)
  const cross = await probe('https://atacante.example')
  record('E1 · Origin de otro host SIN variable → 403 (barrera same-origin)', cross === 403, `status=${cross}`)
  const sinOrigin = await probe(undefined)
  record('E1 · sin Origin (no navegador) → 200 (el endpoint funciona)', sinOrigin === 200, `status=${sinOrigin}`)
  await matar(inst, 'E1')
}

// ── E2: allowlist activa ───────────────────────────────────────
{
  const db = resolve(ROOT, '.agent-tmp/allowlist-e2.db')
  const inst = await instancia('E2 allowlist', db, { NEXT_PUBLIC_SITE_URL: 'https://panel.example' })
  const sitio = await probe('https://panel.example')
  record('E2 · Origin del sitio (Host es 127.0.0.1) → 200 vía allowlist', sitio === 200, `status=${sitio}`)
  const otro = await probe('https://atacante.example')
  record('E2 · Origin de OTRO host → 403 (la allowlist no abre a cualquiera)', otro === 403, `status=${otro}`)
  await matar(inst, 'E2')
}

// ── E3: variable malformada ────────────────────────────────────
{
  const db = resolve(ROOT, '.agent-tmp/allowlist-e3.db')
  const inst = await instancia('E3 variable malformada', db, { NEXT_PUBLIC_SITE_URL: 'no-es-una-url' })
  const sitio = await probe('https://panel.example')
  record('E3 · con URL de sitio malformada el Origin del «sitio» → 403 (no se relaja nada)', sitio === 403, `status=${sitio}`)
  const sinOrigin = await probe(undefined)
  record('E3 · sin Origin → 200 (el endpoint sigue vivo)', sinOrigin === 200, `status=${sinOrigin}`)
  await matar(inst, 'E3')
}

// ── veredicto ──────────────────────────────────────────────────
const fallos = results.filter((r) => !r.ok)
console.log(`\n${results.length - fallos.length}/${results.length} comprobaciones OK`)
if (fallos.length > 0) {
  console.log('FALLOS:', fallos.map((f) => f.name).join(' | '))
  process.exit(1)
}
console.log('VERDE: allowlist de origen sobre standalone — E1 control, E2 allowlist activa, E3 malformada sin relajar')
