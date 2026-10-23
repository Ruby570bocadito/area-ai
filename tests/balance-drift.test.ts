// ─────────────────────────────────────────────────────────────
// Tests del veredicto de deriva de balance (src/lib/sim/balance-drift.ts)
//
// Tarea ROADMAP balance-datos-archivo [S]: el umbral acordado es
// el contrato — SOLO una cuota ≥ 70 % del mismo ganador en 15+
// archivadas dentro de D30 abre recalibración formal de pace.ts.
// Aquí se fijan las fronteras exactas de ese contrato:
//
//   · Muestra: 14 archivadas al 100 % RED → SIN veredicto de
//     deriva (no basta cuota sin muestra).
//   · Frontera de cuota: 21/30 = 70 % exacto → DERIVA_RED.
//   · Bajo umbral: 20/30 = 66,7 % → SIN_DERIVA.
//   · El EMPATE es candidato legítimo a deriva (H-003).
//   · Ventana D30 por startedAt con corte inclusivo.
//   · Solo COMPLETED cuenta para el balance (convención
//     scenario-stats; el motor solo escribe winner al COMPLETED).
//   · El progreso se analiza acotado [0,100] (clampProgress).
// ─────────────────────────────────────────────────────────────

import { describe, expect, test } from 'bun:test'
import {
  buildBalanceDrift,
  DRIFT_MIN_SAMPLE,
  DRIFT_SHARE_THRESHOLD,
  DRIFT_WINDOW_DAYS,
  type BalanceCampaignRow,
} from '../src/lib/sim/balance-drift'

const NOW = new Date('2026-10-23T12:00:00.000Z')
const DIA = 24 * 60 * 60 * 1000

function fila(sobre: Partial<BalanceCampaignRow> = {}): BalanceCampaignRow {
  return {
    status: 'COMPLETED',
    winner: 'RED',
    redProgress: 80,
    blueProgress: 30,
    startedAt: new Date(NOW.getTime() - 5 * DIA),
    engineMode: 'LLM',
    scenarioId: 'esc-nova',
    ...sobre,
  }
}

/** N archivadas con el ganador dado, todas idénticas salvo índice. */
function lote(n: number, winner: 'RED' | 'BLUE' | 'DRAW', sobre: Partial<BalanceCampaignRow> = {}) {
  return Array.from({ length: n }, (_, i) =>
    fila({ winner, redProgress: 40 + (i % 3), scenarioId: `esc-${i % 2}`, ...sobre }),
  )
}

describe('balance-drift · veredicto', () => {
  test('sin campañas → SIN_DATOS, sin líder ni recalibración', () => {
    const r = buildBalanceDrift([], { now: NOW })
    expect(r.veredicto).toBe('SIN_DATOS')
    expect(r.abreRecalibracion).toBe(false)
    expect(r.archivadas).toBe(0)
    expect(r.lider).toBeNull()
    expect(r.shareLider).toBeNull()
    expect(r.progreso.red.media).toBeNull()
  })

  test('solo campañas en curso → SIN_DATOS (nada archivado)', () => {
    const r = buildBalanceDrift([fila({ status: 'RUNNING', winner: null })], { now: NOW })
    expect(r.veredicto).toBe('SIN_DATOS')
    expect(r.enCurso).toBe(1)
  })

  test('muestra insuficiente: 14 archivadas al 100 % RED NO abren recalibración', () => {
    const r = buildBalanceDrift(lote(14, 'RED'), { now: NOW })
    expect(r.archivadas).toBe(14)
    expect(r.veredicto).toBe('MUESTRA_INSUFICIENTE')
    expect(r.abreRecalibracion).toBe(false)
    expect(r.shareLider).toBe(1) // la cuota se informa, pero no basta sola
  })

  test('frontera de cuota: 21/30 (70 % exacto) → DERIVA_RED', () => {
    const campanas = [...lote(21, 'RED'), ...lote(9, 'BLUE')]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.archivadas).toBe(30)
    expect(r.shareLider).toBeCloseTo(0.7, 10)
    expect(r.veredicto).toBe('DERIVA_RED')
    expect(r.abreRecalibracion).toBe(true)
    expect(r.lider).toBe('RED')
  })

  test('bajo umbral: 20/30 (66,7 %) → SIN_DERIVA', () => {
    const campanas = [...lote(20, 'RED'), ...lote(10, 'BLUE')]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.veredicto).toBe('SIN_DERIVA')
    expect(r.abreRecalibracion).toBe(false)
  })

  test('deriva BLUE con mayoría simple amplia', () => {
    const campanas = [...lote(13, 'BLUE'), ...lote(2, 'RED')]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.veredicto).toBe('DERIVA_BLUE')
    expect(r.abreRecalibracion).toBe(true)
  })

  test('todas empate (H-003) con muestra suficiente → DERIVA_EMPATE', () => {
    const r = buildBalanceDrift(lote(DRIFT_MIN_SAMPLE, 'DRAW'), { now: NOW })
    expect(r.veredicto).toBe('DERIVA_EMPATE')
    expect(r.ganadores.EMPATE).toBe(DRIFT_MIN_SAMPLE)
    expect(r.abreRecalibracion).toBe(true)
  })

  test('winner null cuenta como EMPATE (convención scenario-stats)', () => {
    const campanas = lote(DRIFT_MIN_SAMPLE, 'DRAW', { winner: null })
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.ganadores.EMPATE).toBe(DRIFT_MIN_SAMPLE)
    expect(r.veredicto).toBe('DERIVA_EMPATE')
  })

  test('desempate determinista a igual cuota imposible con n par de categorías', () => {
    // 10 RED + 10 BLUE + 10 EMPATE: primera categoría con máx estricto gana el scan (RED),
    // pero 33,3 % < 70 % → SIN_DERIVA; el veredicto no depende del orden de entrada.
    const campanas = [...lote(10, 'RED'), ...lote(10, 'BLUE'), ...lote(10, 'DRAW')]
    const invertidas = [...campanas].reverse()
    const a = buildBalanceDrift(campanas, { now: NOW })
    const b = buildBalanceDrift(invertidas, { now: NOW })
    expect(a.veredicto).toBe('SIN_DERIVA')
    expect(b.veredicto).toBe('SIN_DERIVA')
    expect(a.shareLider).toBeCloseTo(b.shareLider ?? -1, 10)
  })

  test('umbrales exportados coinciden con el contrato del ROADMAP', () => {
    expect(DRIFT_SHARE_THRESHOLD).toBe(0.7)
    expect(DRIFT_MIN_SAMPLE).toBe(15)
    expect(DRIFT_WINDOW_DAYS).toBe(30)
  })
})

describe('balance-drift · ventana D30', () => {
  test('campañas fuera de la ventana se excluyen del balance', () => {
    const viejas = lote(20, 'RED', { startedAt: new Date(NOW.getTime() - 45 * DIA) })
    const r = buildBalanceDrift(viejas, { now: NOW })
    expect(r.totalVentana).toBe(0)
    expect(r.veredicto).toBe('SIN_DATOS')
  })

  test('corte inclusivo: iniciada exactamente hace 30 días ENTRA', () => {
    const alCorte = fila({ startedAt: new Date(NOW.getTime() - 30 * DIA) })
    const r = buildBalanceDrift([alCorte], { now: NOW })
    expect(r.totalVentana).toBe(1)
    expect(r.archivadas).toBe(1)
  })

  test('un milisegundo antes del corte se excluye', () => {
    const fuera = fila({ startedAt: new Date(NOW.getTime() - 30 * DIA - 1) })
    const r = buildBalanceDrift([fuera], { now: NOW })
    expect(r.totalVentana).toBe(0)
    expect(r.veredicto).toBe('SIN_DATOS')
  })

  test('la ventana es configurable (D7) y re-clasifica la muestra', () => {
    const hace10 = lote(20, 'RED', { startedAt: new Date(NOW.getTime() - 10 * DIA) })
    const d30 = buildBalanceDrift(hace10, { now: NOW })
    const d7 = buildBalanceDrift(hace10, { now: NOW, ventanaDias: 7 })
    expect(d30.archivadas).toBe(20)
    expect(d7.totalVentana).toBe(0)
    expect(d7.veredicto).toBe('SIN_DATOS')
  })
})

describe('balance-drift · clasificación de estados y progreso', () => {
  test('ABORTED y RUNNING no diluyen el balance pero sí se cuentan', () => {
    const campanas = [
      ...lote(15, 'RED'),
      fila({ status: 'ABORTED', winner: null }),
      fila({ status: 'RUNNING', winner: null }),
    ]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.archivadas).toBe(15)
    expect(r.abortadas).toBe(1)
    expect(r.enCurso).toBe(1)
    expect(r.totalVentana).toBe(17)
    expect(r.veredicto).toBe('DERIVA_RED')
  })

  test('progreso: media/min/max sobre archivadas con clamp [0,100]', () => {
    const campanas = [
      fila({ redProgress: 114, blueProgress: -3, winner: 'RED' }), // artefacto histórico
      fila({ redProgress: 60, blueProgress: 40, winner: 'BLUE' }),
      fila({ redProgress: 85, blueProgress: 50, winner: 'RED' }),
    ]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.progreso.red).toEqual({ media: 81.67, min: 60, max: 100 })
    expect(r.progreso.blue).toEqual({ media: 30, min: 0, max: 50 })
  })

  test('porEscenario: agrupa archivadas, omite filas sin escenarioId, orden determinista', () => {
    const campanas = [
      ...lote(4, 'RED', { scenarioId: 'esc-b' }),
      ...lote(6, 'BLUE', { scenarioId: 'esc-a' }),
      fila({ scenarioId: null, winner: 'RED' }),
    ]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.porEscenario).toEqual([
      { escenarioId: 'esc-a', finalizadas: 6, red: 0, blue: 6, empates: 0 },
      { escenarioId: 'esc-b', finalizadas: 4, red: 4, blue: 0, empates: 0 },
    ])
  })

  test('porModo: separa LLM de SIM (una deriva solo en SIM apunta a pace.ts)', () => {
    const campanas = [
      ...lote(14, 'RED', { engineMode: 'SIM' }),
      ...lote(4, 'BLUE', { engineMode: 'LLM' }),
    ]
    const r = buildBalanceDrift(campanas, { now: NOW })
    expect(r.porModo).toEqual([
      { modo: 'SIM', finalizadas: 14, red: 14, blue: 0, empates: 0 },
      { modo: 'LLM', finalizadas: 4, red: 0, blue: 4, empates: 0 },
    ])
    expect(r.veredicto).toBe('DERIVA_RED')
  })

  test('mensaje del veredicto menciona el porcentaje y el destino (pace.ts)', () => {
    const r = buildBalanceDrift(lote(DRIFT_MIN_SAMPLE, 'RED'), { now: NOW })
    expect(r.mensaje).toContain('100 %')
    expect(r.mensaje).toContain('pace.ts')
  })
})
