import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CATEGORY,
  KNOWLEDGE_CATEGORIES,
  normalizeLessonCategory,
  normalizeLessonTags,
} from '../src/lib/sim/taxonomy'

// ─────────────────────────────────────────────────────────────
// Contrato de la normalización de lecciones (Ronda 8).
//
// El motor archiva la salida del LLM como entrada no fiable: la
// categoría debe caer siempre en la taxonomía del esquema y los
// tags deben quedar como lista no vacía de tokens no vacíos.
// El canon de humo (Fase 5) valida estos invariantes sobre los
// datos REALES archivados; esta suite fija el contrato de la
// función que los garantiza en la escritura.
// ─────────────────────────────────────────────────────────────

describe('normalizeLessonCategory', () => {
  test('categorías válidas pasan tal cual', () => {
    for (const category of KNOWLEDGE_CATEGORIES) {
      expect(normalizeLessonCategory(category)).toBe(category)
    }
  })

  test('normaliza mayúsculas/minúsculas y espacios sobrantes', () => {
    expect(normalizeLessonCategory('defensa')).toBe('DEFENSA')
    expect(normalizeLessonCategory('  Tactica  ')).toBe('TACTICA')
    expect(normalizeLessonCategory('vulnerabilidad')).toBe('VULNERABILIDAD')
  })

  test('valores fuera de taxonomía degradan a LECCION', () => {
    expect(normalizeLessonCategory('TACTICAL')).toBe('LECCION')
    expect(normalizeLessonCategory('táctica')).toBe('LECCION') // acento fuera de taxonomía
    expect(normalizeLessonCategory('')).toBe('LECCION')
    expect(normalizeLessonCategory('recon')).toBe('LECCION')
  })

  test('entradas no string degradan a LECCION (salida LLM no fiable)', () => {
    expect(normalizeLessonCategory(null)).toBe('LECCION')
    expect(normalizeLessonCategory(undefined)).toBe('LECCION')
    expect(normalizeLessonCategory(42)).toBe('LECCION')
    expect(normalizeLessonCategory({ category: 'TACTICA' })).toBe('LECCION')
    expect(normalizeLessonCategory(['TACTICA'])).toBe('LECCION')
  })

  test('la categoría por defecto es LECCION y pertenece a la taxonomía', () => {
    expect(DEFAULT_CATEGORY).toBe('LECCION')
    expect(KNOWLEDGE_CATEGORIES).toContain(DEFAULT_CATEGORY)
  })
})

describe('normalizeLessonTags', () => {
  test('array de tags (formato del prompt LLM) se une con comas', () => {
    expect(normalizeLessonTags(['recon', 'osint'])).toBe('recon,osint')
  })

  test('cadena ya separada por comas (formato BD) se re-normaliza', () => {
    expect(normalizeLessonTags('recon, osint ,stealth')).toBe('recon,osint,stealth')
  })

  test('recorta, pasa a minúsculas y elimina duplicados y vacíos', () => {
    expect(normalizeLessonTags(['Recon', 'RECON', '', '  ', 'Osint'])).toBe('recon,osint')
    expect(normalizeLessonTags('a,,b')).toBe('a,b')
    expect(normalizeLessonTags(',,')).toBe('general')
  })

  test('sin tokens útiles degrada a general (PHASE_TAGS espera al menos uno)', () => {
    expect(normalizeLessonTags([])).toBe('general')
    expect(normalizeLessonTags('')).toBe('general')
    expect(normalizeLessonTags(null)).toBe('general')
    expect(normalizeLessonTags(undefined)).toBe('general')
    expect(normalizeLessonTags(123)).toBe('general')
  })

  test('respeta el límite de longitud del campo tags (200)', () => {
    const long = normalizeLessonTags(['x'.repeat(150), 'y'.repeat(150)])
    expect(long.length).toBeLessThanOrEqual(200)
  })
})
