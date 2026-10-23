// ─────────────────────────────────────────────────────────────
// Fuzzing de normalizadores y del parseo de URL (tarea
// fuzz-normalizadores del ROADMAP, sesión SEG 4).
//
// Los normalizadores son la barrera por la que entra TODO lo no
// fiable (categorías y tags del LLM, celdas de exportación, texto
// de prompts, segmentos de URL del lab): una excepción aquí es un
// 500 o una inyección. Estas pruebas machacan cada función con
// entradas hostiles GENERADAS DE FORMA DETERMINISTA (PRNG sembrado
// — mismo patrón que engine.test.ts) y exigen invariantes, no
// salidas concretas:
//
//   · normalizeText (text.ts) — nunca lanza; idempotente; salida en
//     minúsculas y sin diacríticos combinantes.
//   · sanitizeForPrompt (text.ts) — nunca lanza con entradas de
//     cualquier tipo; sin \r\n\t; longitud ≤ presupuesto.
//   · csvEscapeCell (text.ts) — la celda resultante NUNCA empieza
//     por los disparadores de fórmula (= + - @ tab CR) y el prefijo
//     de neutralización solo aparece si tocaba.
//   · normalizeLessonCategory (taxonomy.ts) — la salida pertenece
//     SIEMPRE a KNOWLEDGE_CATEGORIES (la whitelist es el contrato).
//   · normalizeLessonTags (taxonomy.ts) — ≤ 200 chars, no vacía, en
//     minúsculas, sin duplicados ni tokens vacíos; sin tokens
//     útiles degrada a 'general' (el matching del motor lo exige).
//   · Parseo de URL del lab (runtime) — segmentos con percent-
//     encoding malformado (`%zz`, `%` final, `%2e%2e`) contra el
//     servidor HTTP REAL: jamás 500 (decodeLabPart degrada a crudo
//     → 404 estructurado) y el lab sigue vivo al final. El traversal
//     codificado quedó perpetuado como caso 13 de security-verify.
//
// Ejecutar: bun test tests/fuzz-normalizadores.test.ts
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { normalizeText, sanitizeForPrompt, csvEscapeCell } from '../src/lib/text'
import { KNOWLEDGE_CATEGORIES, normalizeLessonCategory, normalizeLessonTags } from '../src/lib/sim/taxonomy'
import { ensureLabServer } from '../src/lib/lab/runtime'
import { bootLab, cleanupLab } from '../src/lib/lab/store'
import type { Infrastructure } from '../src/lib/sim/types'

// ── PRNG determinista (mulberry32, patrón engine.test.ts) ──────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ITER = 500

// Alfabeto hostil: acentos, marcas combinantes, disparadores de fórmula CSV,
// percent-encoding (válido y malformado), puntos de traversal, comillas,
// saltos, turcos/ligaduras que cambian longitud al pasar a minúsculas (İ → i̇)
// y emojis sustitutos.
const CHARS = 'aAáÁñÑüÜzZ019 \t\r\n"%\'`;=+@-._…İıﬄ🎉\u0301\u0327%2e%2f..%zz%\\/*?$&{}[]<>|~^'

const fuzzStrings = (seed: number, n: number, minLen = 0, maxLen = 60): string[] => {
  const rnd = mulberry32(seed)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const len = minLen + Math.floor(rnd() * (maxLen - minLen))
    let s = ''
    for (let j = 0; j < len; j++) s += CHARS[Math.floor(rnd() * CHARS.length)]
    out.push(s)
  }
  return out
}

// Entradas no cadena para las funciones que aceptan unknown
const fuzzUnknown = (seed: number, n: number): unknown[] => {
  const rnd = mulberry32(seed)
  const weird: unknown[] = [null, undefined, 42, -0, NaN, true, {}, [], ['A', 'B'], { a: 1 }, () => 'x', Symbol('s'), 1e21]
  return Array.from({ length: n }, (_, i) => (rnd() < 0.25 ? weird[Math.floor(rnd() * weird.length)] : fuzzStrings(seed + i, 1, 0, 40)[0]))
}

describe('fuzz · normalizeText (text.ts)', () => {
  test('nunca lanza y devuelve string', () => {
    for (const s of fuzzStrings(101, ITER)) expect(() => normalizeText(s)).not.toThrow()
  })
  test('idempotente: f(f(x)) === f(x)', () => {
    for (const s of fuzzStrings(102, ITER)) expect(normalizeText(normalizeText(s))).toBe(normalizeText(s))
  })
  test('salida en minúsculas y sin marcas combinantes NFD', () => {
    for (const s of fuzzStrings(103, ITER)) {
      const out = normalizeText(s)
      expect(out).toBe(out.toLowerCase())
      expect(out).not.toMatch(/[\u0300-\u036f]/)
    }
  })
})

describe('fuzz · sanitizeForPrompt (text.ts)', () => {
  test('nunca lanza con entradas de cualquier tipo', () => {
    for (const u of fuzzUnknown(201, ITER)) expect(() => sanitizeForPrompt(u)).not.toThrow()
  })
  test('sin saltos, tabs ni retornos; longitud ≤ presupuesto por defecto', () => {
    for (const u of fuzzUnknown(202, ITER)) {
      const out = sanitizeForPrompt(u)
      expect(out).not.toMatch(/[\r\n\t]/)
      expect(out.length).toBeLessThanOrEqual(240)
    }
  })
  test('respeta presupuestos pequeños y es determinista', () => {
    for (const u of fuzzUnknown(203, ITER)) {
      expect(sanitizeForPrompt(u, 17).length).toBeLessThanOrEqual(17)
      expect(sanitizeForPrompt(u, 17)).toBe(sanitizeForPrompt(u, 17))
    }
  })
})

describe('fuzz · csvEscapeCell (text.ts)', () => {
  test('la celda resultante nunca empieza por un disparador de fórmula', () => {
    for (const s of fuzzStrings(301, ITER)) {
      const out = csvEscapeCell(s)
      expect(out).not.toMatch(/^[=+@\t\r-]/)
    }
  })
  test('toda celda disparadora de fórmula sale con el prefijo de neutralización', () => {
    for (const s of fuzzStrings(302, ITER)) {
      const out = csvEscapeCell(s)
      // Dirección comprobable: si la ENTRADA dispara, la SALIDA lleva el
      // apóstrofe — directamente ('…) o dentro de la envoltura RFC 4180
      // ("'…, cuando además contiene ;/"/salto). La recíproca no vale: una
      // entrada que ya empieza por ' sale igual (no se escapan apóstrofes).
      if (/^[=+\-@\t\r]/.test(s)) expect(/^["']/.test(out)).toBe(true)
      expect(out).toBe(csvEscapeCell(s)) // determinista
    }
  })
})

describe('fuzz · normalizeLessonCategory (taxonomy.ts)', () => {
  test('la salida pertenece SIEMPRE a KNOWLEDGE_CATEGORIES (whitelist)', () => {
    for (const u of fuzzUnknown(401, ITER)) {
      expect(KNOWLEDGE_CATEGORIES).toContain(normalizeLessonCategory(u))
    }
  })
  test('variaciones de caso/espacio de una categoría válida se reconocen', () => {
    const rnd = mulberry32(402)
    for (let i = 0; i < 100; i++) {
      const cat = KNOWLEDGE_CATEGORIES[Math.floor(rnd() * KNOWLEDGE_CATEGORIES.length)]
      const padded = `  ${cat.slice(0, 1).toLowerCase()}${cat.slice(1).toLowerCase()} \t`
      expect(normalizeLessonCategory(padded)).toBe(cat)
    }
  })
})

describe('fuzz · normalizeLessonTags (taxonomy.ts)', () => {
  test('≤ 200 chars, nunca vacía, en minúsculas', () => {
    for (const u of fuzzUnknown(501, ITER)) {
      const out = normalizeLessonTags(u)
      expect(typeof out).toBe('string')
      expect(out.length).toBeGreaterThan(0)
      expect(out.length).toBeLessThanOrEqual(200)
      expect(out).toBe(out.toLowerCase())
    }
  })
  test('sin duplicados, sin tokens vacíos y con degradación a "general"', () => {
    for (const u of fuzzUnknown(502, ITER)) {
      const out = normalizeLessonTags(u)
      const parts = out.split(',')
      expect(new Set(parts).size).toBe(parts.length) // sin duplicados
      expect(parts.every((p) => p.length > 0)).toBe(true) // sin tokens vacíos
      expect(parts.every((p) => p === p.trim())).toBe(true)
    }
    expect(normalizeLessonTags(',,,')).toBe('general')
    expect(normalizeLessonTags([])).toBe('general')
    expect(normalizeLessonTags(null)).toBe('general')
  })
})

// ── Parseo de URL del lab sobre el servidor HTTP REAL ──────────
const FUZZ_CAMP = 'camp-fuzz-norm'
const INFRA: Infrastructure = {
  nodes: [
    {
      id: 'web-portal',
      name: 'Portal Clientes',
      type: 'WEB',
      ip: '10.0.1.10',
      segment: 'DMZ',
      criticality: 4,
      vulnerabilities: ['WAF sin reglas custom'],
      controls: ['WAF básico'],
    },
  ],
}

describe('fuzz · parseo de URL del lab (runtime, HTTP real)', () => {
  let PORT = 0

  beforeAll(async () => {
    // bun test comparte proceso entre ficheros: el servidor del lab es un
    // singleton en globalThis — se usa el que haya (o se arranca) y se usa
    // el puerto que el runtime decide, no uno propio.
    PORT = await ensureLabServer()
    bootLab(FUZZ_CAMP, { key: 'fuzz-norm', company: 'Entidad de Fuzz' }, INFRA)
  })
  afterAll(() => {
    cleanupLab(FUZZ_CAMP)
    // Soltar el singleton para que el siguiente fichero que necesite el lab
    // arranque el suyo con su propio puerto (mismo camino que el runtime
    // aplica ante un servidor zombi).
    const g = globalThis as unknown as {
      __areaLabServer?: { close: () => void }
      __areaLabPort?: number
    }
    try { g.__areaLabServer?.close() } catch { /* noop */ }
    g.__areaLabServer = undefined
    g.__areaLabPort = undefined
  })

  // Segmentos hostiles para las tres posiciones de la ruta del lab:
  // percent-encoding malformado (%zz, % final), traversal codificado y no
  // codificado, separadores, unicode… TODO debe degradar a una respuesta
  // estructurada (400/403/404/200), jamás 500 y jamás desconexión.
  const HOSTILE = [
    '%zz', 'a%2', '%', '%%', '%2e%2e%2f', '..%2f', '..%2fetc', '%2e%2e', '..',
    'camp-fuzz-norm', 'web-portal', 'web%2dportal', '.', 'a..b', '%252e%252e',
    '%C3%A1', '%FF', '%G1', 'x'.repeat(300), 'et%2Fcetera',
  ]

  test('segmentos hostiles en campaignId/nodeId/rest → nunca 500 (decodeLabPart degrada)', async () => {
    for (const a of HOSTILE) {
      for (const b of ['web-portal', '%zz', '%2e%2e']) {
        const r = await fetch(`http://127.0.0.1:${PORT}/lab/${a}/${b}/x`)
        expect(r.status).not.toBe(500)
        await r.text()
      }
    }
  })

  test('rutas compuestas con traversal codificado → firmadas, no 500, y el lab sigue vivo', async () => {
    for (const tail of HOSTILE) {
      const r = await fetch(`http://127.0.0.1:${PORT}/lab/${FUZZ_CAMP}/web-portal/${tail}`)
      expect(r.status).not.toBe(500)
      expect(r.status).not.toBe(0)
      await r.text()
    }
    const health = await fetch(`http://127.0.0.1:${PORT}/lab-health`)
    expect(health.status).toBe(200)
  })

  test('el traversal codificado sigue clasificando tras el fuzz (regresión del caso 13)', async () => {
    // El journal es interno: la señal HTTP observable es que la petición se
    // responde estructurada y el clasificador no revienta — la firma PATH_
    // TRAVERSAL quedó perpetuada end-to-end en security-verify (caso 13, SIEM).
    const r = await fetch(`http://127.0.0.1:${PORT}/lab/${FUZZ_CAMP}/web-portal/..%2fetc%2fpasswd`)
    expect(r.status).toBe(404)
    const body = await r.text()
    expect(body).toContain('..%2fetc%2fpasswd')
  })
})
