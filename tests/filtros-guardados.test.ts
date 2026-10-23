// ─────────────────────────────────────────────────────────────
// Tests del contrato de filtros-guardados (src/hooks/
// use-saved-filters.ts — helpers puros de la tienda localStorage
// del historial, IMP-2).
//
// Fija: sanitización de nombre y búsqueda (topes), validación
// tolerante del parseo (JSON roto, resultado inválido, tipos
// incorrectos, deduplicación por combinación, tope de 8),
// upsert (renombra en sitio sin duplicados, descarta el más
// antiguo cuando la tienda llena) y el nombre sugerido.
// La mecánica de suscripción (useSyncExternalStore + storage)
// es UI de cliente y queda fuera de la suite unitaria.
// ─────────────────────────────────────────────────────────────

import { describe, expect, test } from 'bun:test'
import {
  SAVED_FILTERS_MAX,
  SAVED_FILTERS_NAME_MAX,
  SAVED_FILTERS_QUERY_MAX,
  buildSuggestedName,
  parseSavedFilters,
  sameCombination,
  sanitizeName,
  sanitizeQuery,
  upsertSavedFilter,
  type SavedFilter,
} from '../src/hooks/use-saved-filters'

const preset = (over: Partial<SavedFilter> = {}): SavedFilter => ({
  id: over.id ?? 'id-1',
  name: over.name ?? 'RED wins',
  result: over.result ?? 'RED',
  scenario: over.scenario ?? 'OPERACION_CENTINELA',
  query: over.query ?? '',
  savedAt: over.savedAt ?? '2026-10-23T10:00:00.000Z',
})

describe('sanitizeName', () => {
  test('recorta espacios y colapsa blancos internos', () => {
    expect(sanitizeName('  RED   wins  ')).toBe('RED wins')
  })

  test('respeta el tope de longitud', () => {
    const long = 'a'.repeat(SAVED_FILTERS_NAME_MAX + 20)
    expect(sanitizeName(long).length).toBe(SAVED_FILTERS_NAME_MAX)
  })
})

describe('sanitizeQuery', () => {
  test('recorta bordes y usa el mismo tope que el deep-link ?q=', () => {
    expect(sanitizeQuery('  acme  ')).toBe('acme')
    const long = 'b'.repeat(SAVED_FILTERS_QUERY_MAX + 50)
    expect(sanitizeQuery(long).length).toBe(SAVED_FILTERS_QUERY_MAX)
  })
})

describe('parseSavedFilters', () => {
  test('null, vacío, JSON roto o no-array devuelven lista vacía', () => {
    expect(parseSavedFilters(null)).toEqual([])
    expect(parseSavedFilters('')).toEqual([])
    expect(parseSavedFilters('{roto')).toEqual([])
    expect(parseSavedFilters('{"id":"x"}')).toEqual([])
  })

  test('lista válida se conserva con todos los campos', () => {
    const raw = JSON.stringify([preset()])
    expect(parseSavedFilters(raw)).toEqual([preset()])
  })

  test('descarta entradas corruptas y conserva las buenas', () => {
    const raw = JSON.stringify([
      null,
      'texto',
      { id: '', result: 'RED', name: 'x', scenario: 'S', query: '' },
      { id: 'ok', result: 'INVALIDO', name: 'x', scenario: 'S', query: '' },
      { id: 'ok2', result: 'BLUE', scenario: 'S', query: '' }, // sin name
      preset({ id: 'good' }),
    ])
    expect(parseSavedFilters(raw)).toEqual([preset({ id: 'good' })])
  })

  test('nombre vacío tras sanitizar se descarta', () => {
    const raw = JSON.stringify([preset({ name: '   ' }), preset({ id: 'good', name: 'x' })])
    expect(parseSavedFilters(raw)).toEqual([preset({ id: 'good', name: 'x' })])
  })

  test('deduplica por combinación (gana el primero) y respeta el tope de 8', () => {
    // deduplicación: dos entradas idénticas salvo id y nombre
    const parsedDup = parseSavedFilters(JSON.stringify([
      preset({ id: 'a', name: 'primera' }),
      preset({ id: 'b', name: 'segunda' }),
    ]))
    expect(parsedDup.length).toBe(1)
    expect(parsedDup[0].name).toBe('primera')

    // tope: 12 combinaciones únicas → se quedan las 8 primeras en orden
    const many = Array.from({ length: 12 }, (_, i) =>
      preset({ id: `id-${i}`, name: `n${i}`, scenario: `S${i}` })
    )
    const parsed = parseSavedFilters(JSON.stringify(many))
    expect(parsed.length).toBe(SAVED_FILTERS_MAX)
    expect(parsed.map((f) => f.id)).toEqual(
      Array.from({ length: SAVED_FILTERS_MAX }, (_, i) => `id-${i}`)
    )
  })
})

describe('upsertSavedFilter', () => {
  test('combinación nueva se añade al final con id y savedAt', () => {
    const base = [preset()]
    const { list, replaced } = upsertSavedFilter(
      base,
      { name: 'Draws', result: 'DRAW', scenario: 'ALL', query: '' },
      () => 'id-nuevo'
    )
    expect(replaced).toBe(false)
    expect(list.length).toBe(2)
    expect(list[1]).toEqual({
      id: 'id-nuevo',
      name: 'Draws',
      result: 'DRAW',
      scenario: 'ALL',
      query: '',
      savedAt: list[1].savedAt,
    })
    expect(new Date(list[1].savedAt).getTime()).not.toBeNaN()
  })

  test('combinación existente renombra in situ (mismo id, sin duplicar)', () => {
    const base = [preset(), preset({ id: 'id-2', name: 'BLUE', result: 'BLUE' })]
    const { list, replaced } = upsertSavedFilter(
      base,
      { name: 'Renombrado', result: 'BLUE', scenario: 'OPERACION_CENTINELA', query: '' },
      () => 'id-nuevo'
    )
    expect(replaced).toBe(true)
    expect(list.length).toBe(2)
    expect(list[1].id).toBe('id-2')
    expect(list[1].name).toBe('Renombrado')
  })

  test('tienda llena: descarta el más antiguo para hacer sitio', () => {
    const full = Array.from({ length: SAVED_FILTERS_MAX }, (_, i) =>
      preset({ id: `id-${i}`, result: i % 2 === 0 ? 'RED' : 'BLUE', scenario: `S${i}` })
    )
    const { list, replaced } = upsertSavedFilter(
      full,
      { name: 'nuevo', result: 'DRAW', scenario: 'ALL', query: '' },
      () => 'id-nuevo'
    )
    expect(replaced).toBe(false)
    expect(list.length).toBe(SAVED_FILTERS_MAX)
    expect(list.some((f) => f.id === 'id-0')).toBe(false)
    expect(list[list.length - 1].id).toBe('id-nuevo')
  })

  test('no muta la lista original', () => {
    const base = [preset()]
    upsertSavedFilter(base, { name: 'x', result: 'DRAW', scenario: 'ALL', query: '' }, () => 'id-n')
    expect(base.length).toBe(1)
  })
})

describe('sameCombination', () => {
  test('compara los tres filtros exactos', () => {
    const a = { result: 'RED', scenario: 'S1', query: 'acme' } as const
    expect(sameCombination(a, { ...a })).toBe(true)
    expect(sameCombination(a, { ...a, result: 'BLUE' as SavedFilter['result'] })).toBe(false)
    expect(sameCombination(a, { ...a, scenario: 'S2' })).toBe(false)
    expect(sameCombination(a, { ...a, query: 'otra' })).toBe(false)
  })
})

describe('buildSuggestedName', () => {
  test('combina etiqueta, escenario y búsqueda entre puntos medios', () => {
    expect(buildSuggestedName('RED wins', 'OPERACION_CENTINELA', 'acme')).toBe(
      'RED wins · OPERACION_CENTINELA · “acme”'
    )
  })

  test('omite escenario ALL y búsqueda vacía', () => {
    expect(buildSuggestedName('All', 'ALL', '')).toBe('All')
    expect(buildSuggestedName('All', 'ALL', '   ')).toBe('All')
    expect(buildSuggestedName('', 'ALL', '')).toBe('')
  })
})
