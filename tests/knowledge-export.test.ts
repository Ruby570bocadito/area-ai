import { describe, expect, test } from 'bun:test'
import {
  buildKnowledgeCsv,
  buildKnowledgeJson,
  KNOWLEDGE_CATEGORY_LABEL,
  KNOWLEDGE_CSV_HEADERS,
} from '@/lib/knowledge-export'
import type { KnowledgeListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Contrato del exportador de la memoria del conocimiento
// (Ronda 12, implementaciones): dialecto CSV idéntico al de
// campañas (BOM + «;» + RFC 4180 vía csvEscapeCell) y JSON con
// metadatos y tags normalizados a lista.
// ─────────────────────────────────────────────────────────────

function lesson(overrides: Partial<KnowledgeListItemDTO> = {}): KnowledgeListItemDTO {
  return {
    id: 'k1',
    team: 'RED',
    campaignId: 'campaign-1',
    agentCodename: 'CRIMSON',
    category: 'TACTICA',
    title: 'Reconocimiento silencioso',
    content: 'Divide el barrido en fases cortas para no levantar alertas.',
    tags: 'recon,stealth',
    confidence: 0.72,
    timesUsed: 4,
    timesWorked: 3,
    createdAt: '2026-09-25T10:00:00.000Z',
    campaignCodename: 'OPERACIÓN ÉBANO',
    ...overrides,
  }
}

describe('buildKnowledgeCsv', () => {
  test('empieza con BOM UTF-8 y usa separador «;» en la cabecera exacta', () => {
    const csv = buildKnowledgeCsv([])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    // Sin filas no hay saltos: BOM + cabecera exacta (el join no añade '\n' final)
    expect(csv.slice(1)).toBe(KNOWLEDGE_CSV_HEADERS.join(';'))
  })

  test('memoria vacía → solo BOM + cabecera', () => {
    const csv = buildKnowledgeCsv([])
    expect(csv.split('\n').filter((l) => l !== '').length).toBe(1)
  })

  test('una fila por lección con los campos en orden de cabecera', () => {
    const csv = buildKnowledgeCsv([lesson()])
    const lines = csv.slice(1).split('\n').filter((l) => l !== '')
    expect(lines.length).toBe(2)
    const cells = lines[1].split(';')
    expect(cells[0]).toBe('RED')
    expect(cells[1]).toBe('Táctica')
    expect(cells[2]).toBe('Reconocimiento silencioso')
    expect(cells[3]).toBe('Divide el barrido en fases cortas para no levantar alertas.')
    expect(cells[4]).toBe('recon,stealth')
    expect(cells[5]).toBe('72') // confianza 0.72 → 72%
    expect(cells[6]).toBe('4')
    expect(cells[7]).toBe('3')
    expect(cells[8]).toBe('75') // 3/4 usos con éxito
    expect(cells[9]).toBe('CRIMSON')
    expect(cells[10]).toBe('OPERACIÓN ÉBANO')
    expect(cells[11]).toContain('25/9/2026') // fecha localizada es-ES
  })

  test('celdas con «;» o comillas se escapan según RFC 4180 (comillas dobladas)', () => {
    const csv = buildKnowledgeCsv([
      lesson({
        title: 'Pivot; segunda columna "falsa"',
        content: 'Sin caracteres especiales',
      }),
    ])
    const line = csv.slice(1).split('\n')[1]
    expect(line).toContain('"Pivot; segunda columna ""falsa"""')
    // la celda escapada no añade columnas reales: 12 campos, 11 separadores «;» fuera de comillas
    expect(line).toContain('Sin caracteres especiales')
  })

  test('contenido con salto de línea queda dentro de la celda entrecomillada', () => {
    const csv = buildKnowledgeCsv([lesson({ content: 'línea 1\nlínea 2' })])
    expect(csv).toContain('"línea 1\nlínea 2"')
  })

  test('tasa de éxito vacía cuando la lección no tiene usos', () => {
    const csv = buildKnowledgeCsv([lesson({ timesUsed: 0, timesWorked: 0 })])
    const cells = csv.slice(1).split('\n')[1].split(';')
    expect(cells[6]).toBe('0')
    expect(cells[8]).toBe('')
  })

  test('categoría fuera de la taxonomía pasa tal cual (sin inventar etiqueta)', () => {
    const csv = buildKnowledgeCsv([lesson({ category: 'RARA' })])
    expect(csv).toContain(';RARA;')
    expect(KNOWLEDGE_CATEGORY_LABEL['RARA']).toBeUndefined()
  })

  test('agente y campaña de origen vacíos no rompen la fila', () => {
    const csv = buildKnowledgeCsv([
      lesson({ agentCodename: null, campaignCodename: null, campaignId: null }),
    ])
    const cells = csv.slice(1).split('\n')[1].split(';')
    expect(cells[9]).toBe('')
    expect(cells[10]).toBe('')
  })
})

describe('buildKnowledgeJson', () => {
  test('metadatos: ok, exportedAt ISO, filtros, total y recuento por equipo', () => {
    const now = new Date('2026-09-25T12:00:00.000Z')
    const json = JSON.parse(
      buildKnowledgeJson([lesson(), lesson({ team: 'BLUE', id: 'k2' })], { filtersDesc: 'prueba', red: 1, blue: 1 }, now)
    )
    expect(json.ok).toBe(true)
    expect(json.exportedAt).toBe('2026-09-25T12:00:00.000Z')
    expect(json.filters).toBe('prueba')
    expect(json.total).toBe(2)
    expect(json.red).toBe(1)
    expect(json.blue).toBe(1)
    expect(json.lessons.length).toBe(2)
  })

  test('tags normalizados a lista y tasa de éxito precalculada', () => {
    const json = JSON.parse(buildKnowledgeJson([lesson()], { filtersDesc: '', red: 1, blue: 0 }))
    const l = json.lessons[0]
    expect(l.tags).toEqual(['recon', 'stealth'])
    expect(l.successRate).toBe(75)
    expect(l.confidence).toBe(0.72)
    expect(l.campaignCodename).toBe('OPERACIÓN ÉBANO')
    expect(l.agentCodename).toBe('CRIMSON')
  })

  test('tags con espacios y tokens vacíos se limpian (formato BD «a, b ,,c»)', () => {
    const json = JSON.parse(
      buildKnowledgeJson([lesson({ tags: 'recon, b ,  ,stealth' })], { filtersDesc: '', red: 1, blue: 0 })
    )
    expect(json.lessons[0].tags).toEqual(['recon', 'b', 'stealth'])
  })

  test('sin usos → successRate null (no 0)', () => {
    const json = JSON.parse(
      buildKnowledgeJson([lesson({ timesUsed: 0, timesWorked: 0 })], { filtersDesc: '', red: 1, blue: 0 })
    )
    expect(json.lessons[0].successRate).toBeNull()
  })

  test('salida con indentación 2 (legible) y lista vacía coherente', () => {
    const out = buildKnowledgeJson([], { filtersDesc: 'todo', red: 0, blue: 0 })
    expect(out).toContain('\n  "ok"')
    const json = JSON.parse(out)
    expect(json.total).toBe(0)
    expect(json.lessons).toEqual([])
  })
})
