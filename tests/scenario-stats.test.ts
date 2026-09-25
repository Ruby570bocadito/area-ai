import { describe, expect, test } from 'bun:test'
import { buildScenarioStats } from '@/lib/scenario-stats'
import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Contrato del balance por escenario (Ronda 12): agregación por
// codename, porcentajes sobre finalizadas, orden determinista y
// medias de progreso redondeadas a 1 decimal.
// ─────────────────────────────────────────────────────────────

function row(overrides: Partial<CampaignListItemDTO> = {}): CampaignListItemDTO {
  return {
    id: 'c1',
    status: 'COMPLETED',
    winner: 'RED',
    redProgress: 75,
    blueProgress: 56,
    redScore: 120,
    blueScore: 90,
    startedAt: '2026-09-25T10:00:00.000Z',
    endedAt: '2026-09-25T10:40:00.000Z',
    scenario: {
      codename: 'OPERACIÓN ÉBANO',
      company: 'Helios Robotics',
      industry: 'Industrial',
      difficulty: 3,
    },
    ...overrides,
  }
}

describe('buildScenarioStats', () => {
  test('agrupa por codename con conteos por estado y ganador', () => {
    const stats = buildScenarioStats([
      row(),
      row({ id: 'c2', winner: 'BLUE' }),
      row({ id: 'c3', winner: 'DRAW' }),
      row({ id: 'c4', status: 'RUNNING', winner: null }),
      row({ id: 'c5', status: 'ABORTED', winner: null }),
    ])
    expect(stats.length).toBe(1)
    const s = stats[0]
    expect(s.codename).toBe('OPERACIÓN ÉBANO')
    expect(s.total).toBe(5)
    expect(s.completed).toBe(3)
    expect(s.red).toBe(1)
    expect(s.blue).toBe(1)
    expect(s.draws).toBe(1)
    expect(s.running).toBe(1)
    expect(s.aborted).toBe(1)
  })

  test('COMPLETED con winner null cuenta como empate (convención del informe agregado)', () => {
    const [s] = buildScenarioStats([row({ winner: null })])
    expect(s.completed).toBe(1)
    expect(s.draws).toBe(1)
    expect(s.red).toBe(0)
    expect(s.blue).toBe(0)
  })

  test('porcentajes de victoria sobre finalizadas — las en curso no diluyen', () => {
    const [s] = buildScenarioStats([
      row({ id: 'c1', winner: 'RED' }),
      row({ id: 'c2', winner: 'RED' }),
      row({ id: 'c3', winner: 'BLUE' }),
      row({ id: 'c4', status: 'RUNNING', winner: null }),
    ])
    expect(s.completed).toBe(3)
    expect(s.redPct).toBe(67) // 2/3 → 67
    expect(s.bluePct).toBe(33) // 1/3 → 33
  })

  test('sin finalizadas → porcentajes 0 y medias null', () => {
    const [s] = buildScenarioStats([row({ status: 'RUNNING', winner: null })])
    expect(s.completed).toBe(0)
    expect(s.redPct).toBe(0)
    expect(s.bluePct).toBe(0)
    expect(s.avgRedProgress).toBeNull()
    expect(s.avgBlueProgress).toBeNull()
  })

  test('medias de progreso redondeadas a 1 decimal sobre finalizadas', () => {
    const [s] = buildScenarioStats([
      row({ id: 'c1', redProgress: 50, blueProgress: 61 }),
      row({ id: 'c2', redProgress: 70, blueProgress: 50 }),
    ])
    expect(s.avgRedProgress).toBe(60)
    expect(s.avgBlueProgress).toBe(55.5)
  })

  test('varios escenarios ordenados por total desc y, a igualdad, codename alfabético', () => {
    const stats = buildScenarioStats([
      row({ id: 'a', scenario: { codename: 'ZETA', company: 'X', industry: 'Y', difficulty: 2 } }),
      row({ id: 'b', scenario: { codename: 'ALFA', company: 'X', industry: 'Y', difficulty: 2 } }),
      row({ id: 'c', scenario: { codename: 'ALFA', company: 'X', industry: 'Y', difficulty: 2 } }),
      row({
        id: 'd',
        scenario: { codename: 'MEDIA', company: 'Q', industry: 'Y', difficulty: 4 },
      }),
      row({
        id: 'e',
        scenario: { codename: 'MEDIA', company: 'Q', industry: 'Y', difficulty: 4 },
      }),
      row({
        id: 'f',
        scenario: { codename: 'MEDIA', company: 'Q', industry: 'Y', difficulty: 4 },
      }),
    ])
    expect(stats.map((s) => s.codename)).toEqual(['MEDIA', 'ALFA', 'ZETA'])
    expect(stats.map((s) => s.total)).toEqual([3, 2, 1])
  })

  test('archivo vacío → matriz vacía', () => {
    expect(buildScenarioStats([])).toEqual([])
  })

  test('metadatos del escenario (empresa, industria, dificultad) del primer ejemplar', () => {
    const [s] = buildScenarioStats([row(), row({ id: 'c2' })])
    expect(s.company).toBe('Helios Robotics')
    expect(s.industry).toBe('Industrial')
    expect(s.difficulty).toBe(3)
  })
})
