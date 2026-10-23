#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Veredicto de deriva de balance (D30) — SOLO LECTURA de la BD.
//
// Tarea ROADMAP balance-datos-archivo [S]. Coste cero en LLM:
// no lanza campañas nuevas, no toca el laboratorio, no escribe en
// la BD — analiza las campañas YA ARCHIVADAS y emite el veredicto
// con el umbral acordado (≥ 70 % del mismo ganador en 15+
// finalizadas dentro de la ventana D30 ⇒ abre recalibración
// formal de pace.ts). La lógica vive en src/lib/sim/balance-drift.ts
// (pura, con tests); este script solo la alimenta desde Prisma.
//
// Uso:
//   bun scripts/balance-drift.mjs            # informe legible
//   bun scripts/balance-drift.mjs --json     # JSON para automatización
//   bun scripts/balance-drift.mjs --dias 7   # ventana alternativa
//
// Código de salida: 0 con veredicto emitido (incluso SIN_DERIVA o
// muestra insuficiente) · 1 si no hay BD accesible.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { buildBalanceDrift } from '../src/lib/sim/balance-drift.ts'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const diasIdx = args.indexOf('--dias')
const ventanaDias = diasIdx !== -1 && Number.isFinite(Number(args[diasIdx + 1]))
  ? Number(args[diasIdx + 1])
  : undefined

const db = new PrismaClient()

try {
  const filas = await db.campaign.findMany({
    select: {
      status: true,
      winner: true,
      redProgress: true,
      blueProgress: true,
      startedAt: true,
      engineMode: true,
      scenarioId: true,
    },
    orderBy: { startedAt: 'asc' },
  })

  const informe = buildBalanceDrift(
    filas.map((c) => ({ ...c, startedAt: new Date(c.startedAt) })),
    ventanaDias ? { ventanaDias } : undefined,
  )

  if (asJson) {
    console.log(JSON.stringify(informe, null, 2))
  } else {
    const pct = (n) => `${Math.round((n / Math.max(1, informe.archivadas)) * 1000) / 10} %`
    console.log('══════════════════════════════════════════════════════')
    console.log(`  Veredicto de balance — ventana D${informe.ventanaDias} (solo lectura)`)
    console.log('══════════════════════════════════════════════════════')
    console.log(`  En ventana: ${informe.totalVentana} · archivadas ${informe.archivadas} · en curso ${informe.enCurso} · abortadas ${informe.abortadas}`)
    if (informe.archivadas > 0) {
      console.log(`  Ganadores: RED ${informe.ganadores.RED} (${pct(informe.ganadores.RED)}) · BLUE ${informe.ganadores.BLUE} (${pct(informe.ganadores.BLUE)}) · EMPATE ${informe.ganadores.EMPATE} (${pct(informe.ganadores.EMPATE)})`)
      console.log(`  Progreso final medio: RED ${informe.progreso.red.media}/100 (min ${informe.progreso.red.min}, max ${informe.progreso.red.max}) · BLUE ${informe.progreso.blue.media}/100 (min ${informe.progreso.blue.min}, max ${informe.progreso.blue.max})`)
    }
    if (informe.porModo.length > 0) {
      for (const m of informe.porModo) {
        console.log(`  Modo ${m.modo}: ${m.finalizadas} archivadas — RED ${m.red} · BLUE ${m.blue} · EMPATE ${m.empates}`)
      }
    }
    for (const e of informe.porEscenario) {
      console.log(`  ${e.escenarioId}: ${e.finalizadas} archivadas — RED ${e.red} · BLUE ${e.blue} · EMPATE ${e.empates}`)
    }
    console.log('──────────────────────────────────────────────────────')
    console.log(`  VEREDICTO: ${informe.veredicto}`)
    console.log(`  ${informe.mensaje}`)
    console.log(`  Umbrales: cuota ≥ ${informe.umbralShare * 100} % · muestra ≥ ${informe.umbralMuestra} archivadas`)
    console.log('══════════════════════════════════════════════════════')
  }
} finally {
  await db.$disconnect()
}
