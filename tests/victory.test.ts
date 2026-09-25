// ─────────────────────────────────────────────────────────────
// Tests del contrato de resolución de campaña (src/lib/victory.ts)
//
// La regla de victoria del motor y la escala cerrada del progreso
// [0, 100] viven aquí como fuente única desde la Ronda 9 de bugs
// (reparto 19h31 del Director): engine.ts consume
// resolveCampaignOutcome en la resolución final y la UI comparte
// este módulo para explicar el resultado. Este fichero fija el
// contrato: umbrales de la regla, acotado del progreso y el
// desenlace de saturación (ambos a 100 = empate, nunca gana el
// mayor desbordamiento — la evidencia "114/100" del humo era un
// artefacto de acumulación sin clamp).
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'

import {
  PROGRESS_MAX,
  PROGRESS_MIN,
  clampProgress,
  resolveCampaignOutcome,
} from '../src/lib/victory'

describe('escala cerrada del progreso (clampProgress)', () => {
  test('deja pasar los valores dentro de [0, 100]', () => {
    expect(PROGRESS_MIN).toBe(0)
    expect(PROGRESS_MAX).toBe(100)
    expect(clampProgress(0)).toBe(0)
    expect(clampProgress(45)).toBe(45)
    expect(clampProgress(100)).toBe(100)
    expect(clampProgress(69.5)).toBe(69.5)
  })

  test('acota por arriba y por abajo', () => {
    expect(clampProgress(114)).toBe(100) // evidencia real de la campaña de humo
    expect(clampProgress(1000)).toBe(100)
    expect(clampProgress(-7)).toBe(0)
  })

  test('no finitos degradan a 0 (sin NaN persistible)', () => {
    expect(clampProgress(Number.NaN)).toBe(0)
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampProgress(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('regla de victoria aplicada sobre progreso acotado (resolveCampaignOutcome)', () => {
  test('RED gana con progreso ≥ 70 y superior a la postura BLUE', () => {
    expect(resolveCampaignOutcome(78, 40).winner).toBe('RED')
    expect(resolveCampaignOutcome(70, 69).winner).toBe('RED') // umbral exacto
  })

  test('BLUE gana cuando RED queda por debajo de 45', () => {
    expect(resolveCampaignOutcome(30, 60).winner).toBe('BLUE')
    expect(resolveCampaignOutcome(44, 10).winner).toBe('BLUE') // umbral exacto
  })

  test('empate táctico en los casos intermedios y de igualdad', () => {
    expect(resolveCampaignOutcome(50, 50).winner).toBe('DRAW')
    expect(resolveCampaignOutcome(70, 70).winner).toBe('DRAW') // ≥70 pero sin superar a BLUE
    expect(resolveCampaignOutcome(45, 45).winner).toBe('DRAW') // no <45, no >BLUE
    expect(resolveCampaignOutcome(60, 80).winner).toBe('DRAW') // intermedio, RED no supera a BLUE
  })

  test('0/0 es victoria BLUE: RED frustrado por debajo del umbral de 45', () => {
    // Semántica canónica de la regla (no es empate): RED sin progreso
    // cumple red < 45 → el objetivo ofensivo queda frustrado.
    expect(resolveCampaignOutcome(0, 0).winner).toBe('BLUE')
  })

  test('el desbordamiento NO decide: saturación de ambos = empate a 100/100', () => {
    // Antes del clamp en el motor, 114 vs 105 hubiese declarado RED
    // por comparar desbordes; en la escala cerrada es empate.
    const out = resolveCampaignOutcome(114, 105)
    expect(out.winner).toBe('DRAW')
    expect(out.redProgress).toBe(100)
    expect(out.blueProgress).toBe(100)
  })

  test('devuelve SIEMPRE el progreso acotado junto al ganador', () => {
    expect(resolveCampaignOutcome(120, -5)).toEqual({
      winner: 'RED',
      redProgress: 100,
      blueProgress: 0,
    })
    expect(resolveCampaignOutcome(-10, 80)).toEqual({
      winner: 'BLUE',
      redProgress: 0,
      blueProgress: 80,
    })
  })
})
