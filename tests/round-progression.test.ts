// ─────────────────────────────────────────────────────────────
// Tests de la evolución ronda a ronda (src/lib/round-progression.ts)
//
// La ficha de campaña (/historial/[id]) muestra la telemetría
// agregada por este módulo puro: acciones, impacto y aciertos por
// ronda, acumulados, liderato y puntos de giro. Aquí se fija el
// contrato con datos controlados (Ronda 7), igual que
// aggregate-report.test.ts fija el informe agregado.
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'

import { buildRoundProgression } from '../src/lib/round-progression'
import type { EventDTO } from '../src/lib/api-types'

let seq = 0
function event(overrides: Partial<EventDTO> & { round: number; team: EventDTO['team'] }): EventDTO {
  seq += 1
  return {
    id: `ev-${seq}`,
    seq,
    phase: 'RECON',
    agentKey: null,
    agentCodename: 'AGENTE',
    action: 'Acción de prueba',
    detail: 'detalle',
    result: null,
    impact: 0,
    severity: 'LOW',
    targetNode: null,
    command: null,
    evidence: null,
    createdAt: '2026-09-26T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildRoundProgression (evolución ronda a ronda de la ficha)', () => {
  test('campaña sin eventos de equipos: isEmpty y filas a cero hasta maxRounds', () => {
    const p = buildRoundProgression([event({ round: 6, team: 'SYSTEM', action: 'Fin' })], 6)
    expect(p.isEmpty).toBe(true)
    expect(p.rows).toHaveLength(6)
    expect(p.redTotal).toBe(0)
    expect(p.blueTotal).toBe(0)
    expect(p.turningPoints).toEqual([])
  })

  test('agrega acciones, impacto y aciertos por ronda con acumulados correctos', () => {
    const events: EventDTO[] = [
      event({ round: 1, team: 'RED', impact: 8, result: 'EXITO' }),
      event({ round: 1, team: 'BLUE', impact: 6, result: 'BLOQUEADO' }),
      event({ round: 2, team: 'RED', impact: 5, result: 'PARCIAL' }),
      event({ round: 2, team: 'RED', impact: 0, result: 'FALLO' }),
      event({ round: 2, team: 'BLUE', impact: 1, result: 'IGNORADO' }),
      event({ round: 3, team: 'BLUE', impact: 4, result: 'DETECTADO' }),
    ]
    const p = buildRoundProgression(events, 6)

    expect(p.isEmpty).toBe(false)
    expect(p.rows).toHaveLength(6)

    const r1 = p.rows[0]
    expect(r1.redImpact).toBe(8)
    expect(r1.blueImpact).toBe(6)
    expect(r1.redHits).toBe(1)
    expect(r1.blueHits).toBe(1)
    expect(r1.redCumulative).toBe(8)
    expect(r1.blueCumulative).toBe(6)
    expect(r1.leader).toBe('RED')

    const r2 = p.rows[1]
    expect(r2.redActions).toBe(2)
    expect(r2.blueActions).toBe(1)
    expect(r2.redImpact).toBe(5)
    expect(r2.redHits).toBe(1) // PARCIAL sí; FALLO no
    expect(r2.blueHits).toBe(0) // IGNORADO no cuenta como acierto
    expect(r2.redCumulative).toBe(13)
    expect(r2.blueCumulative).toBe(7)

    const r3 = p.rows[2]
    expect(r3.blueImpact).toBe(4)
    expect(r3.blueCumulative).toBe(11)
    expect(r3.leader).toBe('RED')

    expect(p.redTotal).toBe(13)
    expect(p.blueTotal).toBe(11)
    expect(p.redHitsTotal).toBe(2)
    expect(p.blueHitsTotal).toBe(2)
  })

  test('detecta el punto de giro cuando el liderato acumulado cambia de mano', () => {
    const events: EventDTO[] = [
      event({ round: 1, team: 'RED', impact: 10, result: 'EXITO' }),
      event({ round: 2, team: 'RED', impact: 10, result: 'EXITO' }),
      // BLUE remonta: acumulado azul 22 > 20
      event({ round: 3, team: 'BLUE', impact: 11, result: 'BLOQUEADO' }),
      event({ round: 3, team: 'BLUE', impact: 11, result: 'CONTENIDO' }),
    ]
    const p = buildRoundProgression(events, 3)
    expect(p.turningPoints).toEqual([3])
    expect(p.rows[2].leader).toBe('BLUE')
  })

  test('no marca giro con empates intermedios y conserva el liderato previo', () => {
    const events: EventDTO[] = [
      event({ round: 1, team: 'RED', impact: 10, result: 'EXITO' }),
      event({ round: 2, team: 'BLUE', impact: 10, result: 'BLOQUEADO' }), // empate a 10
      event({ round: 3, team: 'RED', impact: 4, result: 'PARCIAL' }),
    ]
    const p = buildRoundProgression(events, 3)
    expect(p.rows[1].leader).toBeNull() // empate
    expect(p.rows[2].leader).toBe('RED')
    expect(p.turningPoints).toEqual([]) // RED nunca perdió el liderato
  })

  test('rondas sin eventos quedan a cero y no alteran acumulados', () => {
    const events: EventDTO[] = [
      event({ round: 1, team: 'RED', impact: 9, result: 'EXITO' }),
      event({ round: 4, team: 'RED', impact: 3, result: 'PARCIAL' }),
    ]
    const p = buildRoundProgression(events, 6)
    expect(p.rows[1]).toMatchObject({ redImpact: 0, blueImpact: 0, redCumulative: 9, leader: 'RED' })
    expect(p.rows[3].redCumulative).toBe(12)
    expect(p.roundsPlayed).toBe(4)
  })

  test('ignora impactos negativos defensivamente y extiende maxRounds si un evento los excede', () => {
    const events: EventDTO[] = [
      event({ round: 7, team: 'BLUE', impact: -3, result: 'IGNORADO' }),
      event({ round: 7, team: 'RED', impact: 5, result: 'EXITO' }),
    ]
    const p = buildRoundProgression(events, 6)
    expect(p.rows).toHaveLength(7) // maxRounds 6 superado por el evento de ronda 7
    expect(p.rows[6].blueImpact).toBe(0) // impacto negativo acotado a 0
    expect(p.rows[6].redCumulative).toBe(5)
  })
})
