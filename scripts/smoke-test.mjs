#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Test de humo de area·ai (golden path) — recomendación del
// Director para proteger el flujo principal entre rondas de
// varios agentes IA.
//
//   bun run smoke            (o: node scripts/smoke-test.mjs)
//   SMOKE_PORT=3200 bun run smoke
//   SMOKE_START_CAMPAIGN=1 bun run smoke   (arranca además una
//       campaña real end-to-end; tarda ~1 min)
//
// Pasos:
//   1. tsc --noEmit (barrera estática)
//   2. Arranca `next dev` en un puerto aparte (no molesta al dev)
//   3. Espera a que /api/state responda 200 {ok:true}
//   4. Comprueba rutas de página y APIs clave (HTTP 200 + JSON ok)
//   5. (opcional) lanza una campaña y espera su finalización
//   6. Cierra el servidor y sale con código 0/1
// ─────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.SMOKE_PORT || 3100)
const BASE = `http://127.0.0.1:${PORT}`
const START_CAMPAIGN = process.env.SMOKE_START_CAMPAIGN === '1'
const READY_TIMEOUT_MS = 120_000
const STEP_TIMEOUT_MS = 30_000

let failures = 0
const results = []

function ok(name) {
  results.push(`  ✅ ${name}`)
}
function fail(name, detail) {
  failures += 1
  results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
}
function header(name) {
  results.push(`\n▸ ${name}`)
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'pipe', ...opts })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }))
  })
}

async function fetchWithTimeout(url, ms = STEP_TIMEOUT_MS, init) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, cache: 'no-store', ...init })
  } finally {
    clearTimeout(t)
  }
}

async function checkJson(name, url, validate) {
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return fail(name, `HTTP ${res.status}`)
    const data = await res.json()
    if (validate && !validate(data)) return fail(name, 'respuesta inesperada')
    ok(name)
  } catch (e) {
    fail(name, e instanceof Error ? e.message : 'error de red')
  }
}

async function checkPage(name, url) {
  try {
    const res = await fetchWithTimeout(url)
    if (res.ok) ok(name)
    else fail(name, `HTTP ${res.status}`)
  } catch (e) {
    fail(name, e instanceof Error ? e.message : 'error de red')
  }
}

async function waitReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(`${BASE}/api/state`, 5000)
      if (res.ok) {
        const data = await res.json()
        if (data?.ok === true) return true
      }
    } catch {
      // aún no está listo
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

async function waitForCampaignCompletion(campaignId, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(`${BASE}/api/campaigns/${campaignId}`, 10000)
      if (res.ok) {
        const data = await res.json()
        if (data?.campaign?.status === 'COMPLETED') return data
      }
    } catch {
      // reintenta hasta agotar
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return null
}

async function main() {
  console.log('🔥 Smoke test de area·ai — golden path\n')

  // 0. Entorno: .env imprescindible (DATABASE_URL) para que Prisma arranque
  if (!existsSync(resolve(ROOT, '.env'))) {
    console.error('❌ Falta .env en la raíz. Crea uno mínimo con:')
    console.error('   DATABASE_URL="file:./dev.db"')
    process.exit(1)
  }

  // 1. Barrera estática de tipos
  header('1. Tipos (tsc --noEmit)')
  const tsc = await run('npx', ['tsc', '--noEmit'])
  if (tsc.code === 0) ok('tsc sin errores')
  else fail('tsc --noEmit', (tsc.stdout || tsc.stderr).split('\n').slice(0, 5).join(' | '))

  // 2. Arrancar servidor en puerto aparte
  header(`2. Arranque del servidor (next dev -p ${PORT})`)
  const child = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  let serverLog = ''
  child.stdout.on('data', (d) => { serverLog += d })
  child.stderr.on('data', (d) => { serverLog += d })
  try {
    const ready = await waitReady()
    if (ready) ok(`/api/state listo en ${BASE}`)
    else fail('servidor no alcanzable', `timeout ${READY_TIMEOUT_MS / 1000}s. Último log:\n${serverLog.split('\n').slice(-8).join('\n')}`)

    // 3. APIs clave
    header('3. APIs del motor')
    await checkJson('GET /api/state (agregado completo)', `${BASE}/api/state`, (d) => d?.ok === true && Array.isArray(d?.agents) && Array.isArray(d?.scenarios))
    await checkJson('GET /api/campaigns (archivo)', `${BASE}/api/campaigns`, (d) => d?.ok === true && Array.isArray(d?.campaigns))
    await checkJson('GET /api/knowledge (memoria)', `${BASE}/api/knowledge`, (d) => d?.ok === true && Array.isArray(d?.knowledge))

    // ficha de la última campaña si existe
    try {
      const res = await fetchWithTimeout(`${BASE}/api/campaigns`)
      const list = await res.json()
      const firstId = list?.campaigns?.[0]?.id
      if (firstId) {
        await checkJson(`GET /api/campaigns/${firstId.slice(0, 8)}… (ficha)`, `${BASE}/api/campaigns/${firstId}`, (d) => d?.ok === true && Array.isArray(d?.events))
      } else {
        results.push('  ⚠️  sin campañas todavía: ficha no probada (lanza una o usa SMOKE_START_CAMPAIGN=1)')
      }
    } catch {
      // la lista ya fue validada arriba; si falló aquí no añadimos ruido
    }

    // 4. Rutas de página
    header('4. Páginas (HTTP 200)')
    for (const route of ['/', '/arena', '/agentes', '/conocimiento', '/historial', '/analitica', '/modelos']) {
      await checkPage(`GET ${route}`, `${BASE}${route}`)
    }

    // 5. Campaña real end-to-end (opcional)
    if (START_CAMPAIGN) {
      header('5. Campaña real end-to-end (SMOKE_START_CAMPAIGN=1)')
      try {
        const res = await fetchWithTimeout(`${BASE}/api/campaigns`, 20000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (res.ok && data?.ok && data?.campaignId) {
          ok(`POST /api/campaigns → ${data.campaignId.slice(0, 8)}…`)
          const done = await waitForCampaignCompletion(data.campaignId)
          if (done) {
            ok(`campaña COMPLETED ${done.campaign.redScore}–${done.campaign.blueScore} (ganador: ${done.campaign.winner ?? 'DRAW'}) con ${done.events.length} eventos`)
          } else {
            fail('la campaña no finalizó a tiempo', `timeout 180s (campaignId ${data.campaignId})`)
          }
        } else {
          fail('POST /api/campaigns', `HTTP ${res.status} ${data?.error ?? ''}`.trim())
        }
      } catch (e) {
        fail('POST /api/campaigns', e instanceof Error ? e.message : 'error de red')
      }
    }
  } finally {
    child.kill('SIGTERM')
    // apaga también procesos hijos de next si quedaran
    await new Promise((r) => setTimeout(r, 800))
    try { child.kill('SIGKILL') } catch { /* ya muerto */ }
  }

  // Resumen
  console.log(results.join('\n'))
  console.log(`\n${failures === 0 ? '🟢 SMOKE OK' : `🔴 SMOKE FALLIDO — ${failures} comprobación(es) en rojo`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('❌ Smoke test abortado:', e)
  process.exit(1)
})
