import type { EventDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Evolución ronda a ronda de una campaña — módulo puro.
//
// Agrega el registro de eventos (EventDTO, ordenado por seq) en
// filas por ronda para la ficha de campaña (/historial/[id]):
// acciones, impacto y aciertos de cada equipo, acumulados y el
// punto de giro del momentum. Sin React ni DOM, patrón
// aggregate-report.ts / victory.ts: testeable de forma unitaria
// (tests/round-progression.test.ts) y consumible desde cliente.
//
// Semántica de los datos (fuente: src/lib/sim/engine.ts):
//   · `impact` de un evento RED es el avance de progreso que
//     produjo; el de un evento BLUE es la ganancia defensiva
//     (el progreso azul suma impact + 2 por blindaje de base).
//   · Aciertos: RED acierta con EXITO/PARCIAL; BLUE con
//     BLOQUEADO/CONTENIDO/DETECTADO/ENDURECIDO (IGNORADO y
//     FALLO son fallos). Los eventos SYSTEM no puntúan.
// ─────────────────────────────────────────────────────────────

const RED_HITS = new Set(['EXITO', 'PARCIAL'])
const BLUE_HITS = new Set(['BLOQUEADO', 'CONTENIDO', 'DETECTADO', 'ENDURECIDO'])

export interface RoundProgressionRow {
  round: number
  redActions: number
  blueActions: number
  redImpact: number
  blueImpact: number
  redHits: number
  blueHits: number
  /** Impacto acumulado de cada equipo hasta el final de esta ronda */
  redCumulative: number
  blueCumulative: number
  /** Equipo que lidera el impacto acumulado al cierre de la ronda */
  leader: 'RED' | 'BLUE' | null
}

export interface RoundProgression {
  rows: RoundProgressionRow[]
  /** true si no hay eventos de equipos (ficha sin telemetría aún) */
  isEmpty: boolean
  redTotal: number
  blueTotal: number
  redHitsTotal: number
  blueHitsTotal: number
  /** Rondas donde el liderato del impacto acumulado cambió de mano */
  turningPoints: number[]
  /** Ronda efectivamente alcanzada (por si el archivo excede maxRounds) */
  roundsPlayed: number
}

export function buildRoundProgression(events: EventDTO[], maxRounds: number): RoundProgression {
  const teamEvents = events.filter((e) => e.team === 'RED' || e.team === 'BLUE')
  const highestEventRound = teamEvents.reduce((m, e) => Math.max(m, e.round), 0)
  const totalRounds = Math.max(maxRounds, highestEventRound, 1)

  // Índices por ronda para no depender del orden de llegada
  const byRound = new Map<number, { red: EventDTO[]; blue: EventDTO[] }>()
  for (const e of teamEvents) {
    let bucket = byRound.get(e.round)
    if (!bucket) {
      bucket = { red: [], blue: [] }
      byRound.set(e.round, bucket)
    }
    bucket[e.team === 'RED' ? 'red' : 'blue'].push(e)
  }

  const rows: RoundProgressionRow[] = []
  const turningPoints: number[] = []
  let redCumulative = 0
  let blueCumulative = 0
  let redHitsTotal = 0
  let blueHitsTotal = 0
  let previousLeader: 'RED' | 'BLUE' | null = null

  for (let round = 1; round <= totalRounds; round++) {
    const bucket = byRound.get(round) ?? { red: [], blue: [] }
    const redImpact = bucket.red.reduce((s, e) => s + Math.max(0, e.impact), 0)
    const blueImpact = bucket.blue.reduce((s, e) => s + Math.max(0, e.impact), 0)
    const redHits = bucket.red.filter((e) => RED_HITS.has(e.result ?? '')).length
    const blueHits = bucket.blue.filter((e) => BLUE_HITS.has(e.result ?? '')).length

    redCumulative += redImpact
    blueCumulative += blueImpact
    redHitsTotal += redHits
    blueHitsTotal += blueHits

    const leader: 'RED' | 'BLUE' | null =
      redCumulative === blueCumulative ? null : redCumulative > blueCumulative ? 'RED' : 'BLUE'
    if (leader !== null && previousLeader !== null && leader !== previousLeader) {
      turningPoints.push(round)
    }
    if (leader !== null) previousLeader = leader

    rows.push({
      round,
      redActions: bucket.red.length,
      blueActions: bucket.blue.length,
      redImpact,
      blueImpact,
      redHits,
      blueHits,
      redCumulative,
      blueCumulative,
      leader,
    })
  }

  return {
    rows,
    isEmpty: teamEvents.length === 0,
    redTotal: redCumulative,
    blueTotal: blueCumulative,
    redHitsTotal,
    blueHitsTotal,
    turningPoints,
    roundsPlayed: highestEventRound,
  }
}
