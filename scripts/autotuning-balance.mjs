#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Autotuning de balance — lanza N campañas deterministas por
// escenario y reporta la tasa de victoria de RED (objetivo
// orientativo 40-60 %).
//
// Tarea ROADMAP autotuning-balance [M]. Coste cero en LLM:
// determinista:true fuerza SIM sin sonda (seed-determinista), así
// que las campañas son cómputo local (~15-30 s cada una: el bucle
// tiene pausas reales de 500 ms/evento — esa ES la medición). Con
// la dificultad adaptativa NEUTRA de serie en determinista, el
// veredicto mide el pace RAW — señal limpia para la banda.
//
// El veredicto vive en src/lib/sim/pace.ts (puro, con tests); este
// script solo lanza, espera y reporta (molde balance-drift.mjs).
// Semillas REPRODUCIBLES 1..N por escenario (--semilla-base): la
// misma N reproduce exactamente el mismo sample — las pasadas de
// calibración son comparables entre sí.
//
// Higiene: por defecto el script LIMPIA lo que lanza (lecciones de
// esas campañas + filas de campaña; los eventos van en cascada por
// FK) — no contamina el archivo que mide balance-drift ni inunda el
// historial. --dejar conserva la muestra como archivo.
//
// Uso:
//   bun scripts/autotuning-balance.mjs                 # 5 por escenario
//   bun scripts/autotuning-balance.mjs --n 10          # muestra mayor
//   bun scripts/autotuning-balance.mjs --escenario <key|id>
//   bun scripts/autotuning-balance.mjs --json          # automatización
//   bun scripts/autotuning-balance.mjs --dejar         # conserva filas
//
// Código de salida: 0 veredicto emitido sin fallos · 3 veredicto
// parcial (campañas abortadas o tiempo agotado) · 1 sin BD o sin
// escenarios · 2 hay una campaña RUNNING que bloquea el cerrojo ·
// 4 argumentos inválidos.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { startCampaign, recoverOrphanCampaigns } from '../src/lib/sim/engine.ts'
import { veredictoAutotuning } from '../src/lib/sim/pace.ts'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const dejar = args.includes('--dejar')

const numArg = (flag) => {
  const i = args.indexOf(flag)
  if (i === -1) return undefined
  const v = Number(args[i + 1])
  return Number.isFinite(v) ? v : NaN
}
const strArg = (flag) => {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

const N = numArg('--n') ?? 5
const semillaBase = numArg('--semilla-base') ?? 1
const filtro = strArg('--escenario')

if (!Number.isInteger(N) || N < 1 || N > 30) {
  console.error('--n debe ser un entero entre 1 y 30 (rece: ' + args[args.indexOf('--n') + 1] + ')')
  process.exit(4)
}
if (!Number.isInteger(semillaBase) || semillaBase < 0 || semillaBase > 2147483647 - N) {
  console.error('--semilla-base debe dejar hueco para N semillas dentro de [0, 2147483647]')
  process.exit(4)
}

const db = new PrismaClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Espera a que la campaña salga de RUNNING. Devuelve la fila final o
// null si agota el tiempo (240 s: las deterministas terminan en 15-30 s
// con margen holgado para el arranque del lab).
const esperarFinal = async (id, ms = 240_000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const fila = await db.campaign.findUnique({ where: { id } })
    if (!fila) return null
    if (fila.status !== 'RUNNING') return fila
    await sleep(500)
  }
  return null
}

const porcentaje = (n, total) => `${Math.round((n / Math.max(1, total)) * 1000) / 10} %`

try {
  // Higiene de arranque: las huérfanas de una corrida interrumpida
  // (proceso muerto > 2 min sin eventos) se cierran para no bloquear
  // el cerrojo; una campaña VIVA de un servidor en marcha no se toca
  // — y si sigue RUNNING, el script se retira (el cerrojo es global).
  await recoverOrphanCampaigns()
  const enCurso = await db.campaign.findFirst({ where: { status: 'RUNNING' } })
  if (enCurso) {
    if (asJson) {
      console.log(JSON.stringify({ ok: false, error: 'CAMPAIGN_RUNNING', campaignId: enCurso.id }))
    } else {
      console.error('Hay una campaña RUNNING (' + enCurso.id + '): el cerrojo de lanzamiento es global.')
      console.error('Espera a que termine o ciérrala antes de medir.')
    }
    process.exit(2)
  }

  const todos = await db.scenario.findMany({ orderBy: { key: 'asc' } })
  const escenarios = filtro ? todos.filter((s) => s.id === filtro || s.key === filtro) : todos
  if (escenarios.length === 0) {
    console.error(filtro
      ? `No hay escenario con id o key «${filtro}» (visibles: ${todos.map((s) => s.key).join(', ') || 'ninguno'})`
      : 'No hay escenarios en la BD (arranca la app una vez para sembrar el roster).')
    process.exit(1)
  }

  const progreso = (linea) => (asJson ? console.error(linea) : console.log(linea))
  progreso(`Autotuning: ${N} campañas deterministas × ${escenarios.length} escenario(s) · semillas ${semillaBase}..${semillaBase + N - 1}`)
  progreso(`Coste LLM: cero (SIM forzado) · duración estimada: ~${Math.ceil((escenarios.length * N * 25) / 60)} min\n`)

  const informe = []
  const lanzadas = [] // ids creados, para la limpieza
  const fallos = []

  for (const esc of escenarios) {
    const cifras = { total: 0, red: 0, blue: 0, empate: 0 }
    const t0Esc = Date.now()
    for (let i = 0; i < N; i++) {
      const seed = semillaBase + i
      let camp
      try {
        camp = await startCampaign(esc.id, seed, true) // determinista: SIM sin sonda
      } catch (err) {
        fallos.push({ escenario: esc.key, seed, motivo: 'lanzar: ' + (err?.message ?? String(err)) })
        break // el cerrojo de lanzamiento está en mal estado: no insistir
      }
      lanzadas.push(camp.id)
      const fin = await esperarFinal(camp.id)
      if (!fin || fin.status !== 'COMPLETED') {
        fallos.push({ escenario: esc.key, seed, motivo: fin ? 'estado ' + fin.status : 'tiempo agotado (240 s)' })
        continue
      }
      cifras.total++
      if (fin.winner === 'RED') cifras.red++
      else if (fin.winner === 'BLUE') cifras.blue++
      else cifras.empate++
      progreso(`  [${esc.key}] ${cifras.total}/${N} · seed ${seed} → ${fin.winner} (${fin.redProgress}/${fin.blueProgress})`)
    }
    informe.push({
      key: esc.key,
      id: esc.id,
      cifras,
      veredicto: veredictoAutotuning(cifras),
      segundos: Math.round((Date.now() - t0Esc) / 1000),
    })
  }

  const global = {
    cifras: informe.reduce(
      (acc, e) => ({ total: acc.total + e.cifras.total, red: acc.red + e.cifras.red, blue: acc.blue + e.cifras.blue, empate: acc.empate + e.cifras.empate }),
      { total: 0, red: 0, blue: 0, empate: 0 },
    ),
  }
  global.veredicto = veredictoAutotuning(global.cifras)

  // Limpieza por defecto: la muestra es medición, no archivo. Las
  // lecciones sintéticas de SIM se borran primero (la FK es opcional
  // y sobrevivirían con provenance rota); los eventos van en cascada.
  let limpieza = 'conservada'
  if (!dejar && lanzadas.length > 0) {
    await db.knowledge.deleteMany({ where: { campaignId: { in: lanzadas } } })
    await db.campaign.deleteMany({ where: { id: { in: lanzadas } } })
    limpieza = 'eliminada'
  }

  const salida = {
    generado: new Date().toISOString(),
    opciones: { n: N, semillaBase, escenario: filtro ?? 'todos', determinista: true, adaptativa: 'neutra (SIM de serie)' },
    limpieza,
    escenarios: informe,
    global,
    fallos,
  }

  if (asJson) {
    console.log(JSON.stringify(salida, null, 2))
  } else {
    const linea = (nombre, v, extra = '') =>
      `  ${nombre.padEnd(28)} ${String(v.finalizadas).padStart(3)} campañas · RED ${porcentaje(Math.round((v.tasaRed ?? 0) * v.finalizadas), v.finalizadas).padStart(6)} · empate ${porcentaje(Math.round(v.tasaEmpate * v.finalizadas), v.finalizadas).padStart(6)} · ${v.estado}${extra}`
    console.log('\n══════════════════════════════════════════════════════')
    console.log('  Autotuning de balance — tasa de victoria RED (objetivo 40-60 %)')
    console.log('══════════════════════════════════════════════════════')
    for (const e of informe) {
      const corto = e.key.length > 28 ? e.key.slice(0, 27) + '…' : e.key
      console.log(linea(corto, e.veredicto, `  (${e.segundos}s)`))
    }
    console.log('  ────────────────────────────────────────────────────')
    console.log(linea('GLOBAL', global.veredicto))
    if (limpieza === 'eliminada') console.log('\n  Muestra eliminada de la BD (--dejar la conserva).')
    else console.log('\n  Muestra conservada en el archivo (--dejar).')
    if (fallos.length > 0) {
      console.log(`  Fallos: ${fallos.length}`)
      for (const f of fallos) console.log(`    · [${f.escenario}] seed ${f.seed}: ${f.motivo}`)
    }
    console.log('\n  Fuera de banda no recalibra: abre la pregunta de recalibración')
    console.log('  formal de pace.ts (decisión de DIR, como balance-datos-archivo).')
  }

  process.exit(fallos.length > 0 ? 3 : 0)
} catch (error) {
  console.error('[autotuning-balance] error:', error?.message ?? error)
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
