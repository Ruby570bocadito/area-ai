// ─────────────────────────────────────────────────────────────
// Tests del generador del informe agregado del archivo
// (src/lib/aggregate-report.ts — módulo puro, Ronda 6).
//
// Complemento del canon de humo: mientras SMOKE_START_CAMPAIGN
// valida el informe con datos reales end-to-end, aquí se fija el
// CONTRATO del formato con datos controlados: cabecera con
// filtros, resumen ejecutivo, una sección por campaña con su
// etiqueta de resultado, duraciones y pie.
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'

import { buildAggregateReport } from '../src/lib/aggregate-report'
import type { CampaignListItemDTO } from '../src/lib/api-types'

function campaign(overrides: Partial<CampaignListItemDTO> & { id: string }): CampaignListItemDTO {
  return {
    status: 'COMPLETED',
    winner: null,
    redProgress: 50,
    blueProgress: 50,
    redScore: 10,
    blueScore: 10,
    startedAt: '2026-09-26T10:00:00.000Z',
    endedAt: '2026-09-26T10:10:00.000Z', // 10 min exactos
    scenario: { codename: 'NOVARETAIL', company: 'NovaRetail', industry: 'Retail', difficulty: 3 },
    ...overrides,
  }
}

const FIXED_NOW = new Date('2026-09-26T12:00:00.000Z')

describe('buildAggregateReport (informe agregado del archivo)', () => {
  test('cabecera: título, fecha de generación, total y filtros activos', () => {
    const md = buildAggregateReport([], 'ninguno (archivo completo)', FIXED_NOW)
    expect(md.startsWith('# Informe agregado del archivo — area·ai')).toBe(true)
    expect(md).toContain('- **Campañas incluidas:** 0')
    expect(md).toContain('- **Filtros aplicados:** ninguno (archivo completo)')
  })

  test('resumen ejecutivo: victorias, porcentajes, medias y escenario más repetido', () => {
    const md = buildAggregateReport(
      [
        campaign({ id: 'c1', winner: 'RED', redProgress: 80, blueProgress: 30, redScore: 14, blueScore: 6 }),
        campaign({ id: 'c2', winner: 'BLUE', redProgress: 20, blueProgress: 75, redScore: 4, blueScore: 12 }),
        campaign({ id: 'c3', winner: 'RED', redProgress: 90, blueProgress: 40, redScore: 18, blueScore: 5 }),
        campaign({ id: 'c4', status: 'RUNNING', winner: null }),
      ],
      'solo victorias RED',
      FIXED_NOW
    )
    expect(md).toContain('| Victorias RED | 2 (66.7%) |')
    expect(md).toContain('| Victorias BLUE | 1 (33.3%) |')
    expect(md).toContain('| Empates | 0 (0%) |')
    expect(md).toContain('| Finalizadas · en curso · abortadas | 3 · 1 · 0 |')
    expect(md).toContain('| Escenario más repetido | NOVARETAIL (4 campañas) |')
    // media de redProgress con 0 decimales (formato del informe): (80+20+90)/3 = 63
    expect(md).toContain('| Progreso medio de objetivos (RED / BLUE) | 63 / 48 de 100 |')
  })

  test('una sección por campaña con etiqueta de resultado, marcador, duración y ficha', () => {
    const md = buildAggregateReport(
      [
        campaign({ id: 'abc123', winner: 'RED', redProgress: 85, blueProgress: 35, redScore: 12, blueScore: 7 }),
        campaign({ id: 'def456', status: 'ABORTED', winner: null }),
      ],
      'todas',
      FIXED_NOW
    )
    expect(md).toContain('### 1. NOVARETAIL — NovaRetail (Retail)')
    expect(md).toContain('- **Resultado:** GANA RED · 12–7 (objetivos RED 85% vs BLUE 35%)')
    expect(md).toContain('- **Resultado:** ABORTADA')
    expect(md).toContain('- **Periodo:**')
    // 10 minutos exactos de duración
    expect(md).toContain('(10m 00s)')
    expect(md).toContain('- **Ficha completa:** /historial/abc123')
    expect(md).toContain('- **Ficha completa:** /historial/def456')
  })

  test('sin campañas completadas las medias son «—» y no se divide por cero', () => {
    const md = buildAggregateReport([campaign({ id: 'x1', status: 'RUNNING', winner: null })], 'solo en curso', FIXED_NOW)
    expect(md).toContain('| Duración media de campaña | — |')
    expect(md).toContain('| Victorias RED | 0 (—) |')
    expect(md).toContain('| Progreso medio de objetivos (RED / BLUE) | — / — de 100 |')
  })

  test('formato markdown saneado: sin líneas en blanco dobles y pie presente', () => {
    const md = buildAggregateReport(
      [campaign({ id: 'ok1', winner: 'DRAW', redProgress: 50, blueProgress: 55 })],
      'todas',
      FIXED_NOW
    )
    expect(md.includes('\n\n\n')).toBe(false)
    expect(md).toContain('La telemetría completa de cada enfrentamiento')
    expect(md.endsWith('Generado por area·ai — laboratorio adversarial de agentes IA.')).toBe(true)
  })
})
