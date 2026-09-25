// ─────────────────────────────────────────────────────────────
// Tests del contrato de ritmo e intensidad (src/lib/sim/pace.ts)
//
// El motor deriva de este módulo la cadencia de acciones y las
// escalas de impacto. Aquí se fijan las invariantes que el juego
// asume (Ronda 9, petición directa del usuario de campañas más
// largas, intensas y extensas):
//
//   · 12 rondas = las 6 fases MITRE × 2, en pares contiguos y en
//     orden de kill-chain (el maxRounds del motor es PHASE_ORDER.length).
//   · Las probabilidades de cadencia están en [0, 1] y la
//     reacción defensiva es SIEMPRE posible (no hay rondas mudas).
//   · Las escalas de impacto están completas (cualquier gravedad,
//     fase o veredicto tiene valor) y monótonas (más grave no
//     impacta menos), y recalibradas a la baja respecto de las
//     magnitudes de 8 rondas para no saturar la escala [0, 100].
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'

import { PHASE_ORDER, PHASE_LABEL } from '../src/lib/sim/types'
import {
  BLUE_GAIN_BY_VERDICT,
  BLUE_HUNT_ROLL,
  CHAINABLE_PHASES,
  DEFAULT_SEVERITY_BY_PHASE,
  PARTIAL_IMPACT_FACTOR,
  RED_CHAIN_ON_EXITO,
  RED_CHAIN_ON_PARCIAL,
  RED_IMPACT_BY_SEVERITY,
} from '../src/lib/sim/pace'

const PHASES: (keyof typeof PHASE_LABEL)[] = ['RECON', 'ARMADO', 'INTRUSION', 'ESCALADA', 'LATERAL', 'OBJETIVO']
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const VERDICTS = ['BLOQUEADO', 'CONTENIDO', 'DETECTADO', 'ENDURECIDO', 'IGNORADO']

describe('campañas largas — estructura de fases', () => {
  test('la campaña dura 12 rondas: las 6 fases × 2', () => {
    expect(PHASE_ORDER).toHaveLength(12)
    for (const phase of PHASES) {
      expect(PHASE_ORDER.filter((p) => p === phase)).toHaveLength(2)
    }
  })

  test('cada fase ocupa dos rondas contiguas y el orden respeta la kill-chain', () => {
    for (let i = 0; i < PHASE_ORDER.length; i += 2) {
      expect(PHASE_ORDER[i]).toBe(PHASE_ORDER[i + 1])
    }
    const firstRoundOfPhase = PHASES.map((p) => PHASE_ORDER.indexOf(p))
    const sorted = [...firstRoundOfPhase].sort((a, b) => a - b)
    expect(firstRoundOfPhase).toEqual(sorted)
  })
})

describe('campañas intensas — cadencia', () => {
  test('las probabilidades de encadenamiento y hunting están en [0, 1]', () => {
    for (const p of [RED_CHAIN_ON_EXITO, RED_CHAIN_ON_PARCIAL, BLUE_HUNT_ROLL]) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })

  test('RED encadena con más fuerza tras un ÉXITO que tras un PARCIAL', () => {
    expect(RED_CHAIN_ON_EXITO).toBeGreaterThan(RED_CHAIN_ON_PARCIAL)
    // intensidad creciente respecto del diseño de 8 rondas (0.40 / 0)
    expect(RED_CHAIN_ON_EXITO).toBeGreaterThan(0.4)
    expect(RED_CHAIN_ON_PARCIAL).toBeGreaterThan(0)
  })

  test('las fases encadenables son las de contacto (ni RECON ni ARMADO)', () => {
    expect(CHAINABLE_PHASES).not.toContain('RECON')
    expect(CHAINABLE_PHASES).not.toContain('ARMADO')
    for (const phase of CHAINABLE_PHASES) {
      expect(PHASES).toContain(phase)
    }
  })
})

describe('campañas intensas — escalas de impacto recalibradas', () => {
  test('la tabla RED cubre las 4 gravedades y es monótona creciente', () => {
    expect(Object.keys(RED_IMPACT_BY_SEVERITY).sort()).toEqual([...SEVERITIES].sort())
    expect(RED_IMPACT_BY_SEVERITY.LOW).toBeLessThan(RED_IMPACT_BY_SEVERITY.MEDIUM)
    expect(RED_IMPACT_BY_SEVERITY.MEDIUM).toBeLessThan(RED_IMPACT_BY_SEVERITY.HIGH)
    expect(RED_IMPACT_BY_SEVERITY.HIGH).toBeLessThan(RED_IMPACT_BY_SEVERITY.CRITICAL)
  })

  test('los impactos RED caben en la escala cerrada [0, 100] con margen para 12 rondas', () => {
    // techo por acción por debajo del máximo histórico (16): sin
    // recalibración, ~18 acciones RED saturarían la escala antes del final
    for (const impact of Object.values(RED_IMPACT_BY_SEVERITY)) {
      expect(impact).toBeGreaterThan(0)
      expect(impact).toBeLessThanOrEqual(12)
      expect(impact * PARTIAL_IMPACT_FACTOR).toBeLessThan(impact)
    }
  })

  test('la tabla BLUE cubre los 5 veredictos y es monótona decreciente por contención', () => {
    expect(Object.keys(BLUE_GAIN_BY_VERDICT).sort()).toEqual([...VERDICTS].sort())
    expect(BLUE_GAIN_BY_VERDICT.BLOQUEADO).toBeGreaterThan(BLUE_GAIN_BY_VERDICT.DETECTADO)
    expect(BLUE_GAIN_BY_VERDICT.DETECTADO).toBeGreaterThanOrEqual(BLUE_GAIN_BY_VERDICT.ENDURECIDO)
    expect(BLUE_GAIN_BY_VERDICT.ENDURECIDO).toBeGreaterThan(BLUE_GAIN_BY_VERDICT.IGNORADO)
  })

  test('la gravedad por defecto está definida para las 6 fases y coherente con la tabla RED', () => {
    expect(Object.keys(DEFAULT_SEVERITY_BY_PHASE).sort()).toEqual([...PHASES].sort())
    for (const severity of Object.values(DEFAULT_SEVERITY_BY_PHASE)) {
      expect(RED_IMPACT_BY_SEVERITY[severity]).toBeDefined()
    }
    // el objetivo es siempre el golpe más grave; el reconocimiento, el más leve
    expect(DEFAULT_SEVERITY_BY_PHASE.OBJETIVO).toBe('CRITICAL')
    expect(DEFAULT_SEVERITY_BY_PHASE.RECON).toBe('LOW')
  })
})
