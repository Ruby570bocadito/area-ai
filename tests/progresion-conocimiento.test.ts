// ─────────────────────────────────────────────────────────────
// Tests de progresión, conocimiento y configuración de proveedor
// (src/lib/sim/progression.ts, knowledge-score.ts, provider-config.ts)
//
// Red de seguridad de la tarea ALTA tests-progresion-conocimiento:
//   · Progresión — curva de XP potencia (fuente única de niveles
//     para el motor y la UI): invariante de ida y vuelta entre
//     levelForXp y xpFloorForLevel, anti-inflación con volúmenes
//     grandes (el autopiloto inflaba Nv46 con la curva lineal) y
//     coherencia de xpToNextLevel.
//   · Conocimiento — fórmula 60/30/10 (confianza declarada, ratio
//     de éxito real, madurez saturada en 10 usos): fuente única del
//     orden del panel, de la reinyección de memoria del motor y de
//     la puntuación mostrada en UI.
//   · Proveedor LLM — prioridad de lectura BD → env → z-ai, caché
//     en memoria con invalidación explícita, enmascarado de claves
//     para la UI y guardado real en la BD local (con limpieza).
//
// Ejecutar: bun test tests/progresion-conocimiento.test.ts
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { knowledgeScore } from '../src/lib/sim/knowledge-score'
import { levelForXp, xpFloorForLevel, xpToNextLevel } from '../src/lib/sim/progression'
import {
  getProviderConfig,
  invalidateProviderCache,
  maskKey,
  saveProviderConfig,
} from '../src/lib/sim/provider-config'
import { db } from '../src/lib/db'

// ─────────────────────────────────────────────────────────────
// 1. Progresión — curva de XP
// ─────────────────────────────────────────────────────────────

describe('curva de XP (levelForXp / xpFloorForLevel)', () => {
  test('0 o XP negativo → Nv1', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(-50)).toBe(1)
  })

  test('la curva potencia da los valores de frontera documentados', () => {
    expect(xpFloorForLevel(1)).toBe(0)
    expect(xpFloorForLevel(2)).toBe(60)
    expect(xpFloorForLevel(3)).toBe(191) // ceil(60 · 2^(1/0.6))
    expect(levelForXp(59)).toBe(1)
    expect(levelForXp(60)).toBe(2)
    expect(levelForXp(190)).toBe(2)
    expect(levelForXp(191)).toBe(3)
  })

  test('es monótona no decreciente en XP', () => {
    let previo = levelForXp(0)
    for (let xp = 1; xp <= 20000; xp += 97) {
      const nivel = levelForXp(xp)
      expect(nivel).toBeGreaterThanOrEqual(previo)
      previo = nivel
    }
  })

  test('invariante de ida y vuelta: floor(level(xp)) ≤ xp < floor(level(xp)+1)', () => {
    for (let xp = 0; xp <= 5000; xp += 37) {
      const nivel = levelForXp(xp)
      expect(xpFloorForLevel(nivel)).toBeLessThanOrEqual(xp)
      expect(xp).toBeLessThan(xpFloorForLevel(nivel + 1))
    }
  })

  test('anti-inflación: volúmenes grandes quedan en niveles creíbles', () => {
    // La curva lineal antigua (xp/80) habría dado Nv1250 con 100k XP
    expect(levelForXp(100_000)).toBeLessThan(100)
    expect(levelForXp(1_000_000)).toBeLessThan(600)
  })

  test('xpToNextLevel: lo que falta encaja con el suelo del nivel siguiente', () => {
    const { have, need } = xpToNextLevel(60)
    expect(have).toBe(0)
    expect(need).toBe(xpFloorForLevel(3) - xpFloorForLevel(2))
    expect(need).toBeGreaterThan(0)
  })

  test('xpToNextLevel: siempre 0 ≤ have < need', () => {
    for (const xp of [0, 1, 59, 60, 191, 500, 3210, 15000]) {
      const { have, need } = xpToNextLevel(xp)
      expect(have).toBeGreaterThanOrEqual(0)
      expect(have).toBeLessThan(need)
      expect(need).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 2. Fuerza del conocimiento — fórmula 60/30/10
// ─────────────────────────────────────────────────────────────

describe('puntuación de conocimiento (knowledgeScore)', () => {
  test('sin usos: ratio neutro 0.5 (la lección no ha demostrado nada)', () => {
    expect(knowledgeScore({ confidence: 1, timesUsed: 0, timesWorked: 0 })).toBeCloseTo(0.75) // 0.6 + 0.15
  })

  test('todo perfecto y saturado: 1.0', () => {
    expect(knowledgeScore({ confidence: 1, timesUsed: 10, timesWorked: 10 })).toBeCloseTo(1.0)
  })

  test('la madurez se satura en 10 usos', () => {
    const saturada = knowledgeScore({ confidence: 1, timesUsed: 20, timesWorked: 20 })
    expect(saturada).toBeCloseTo(1.0)
    const media = knowledgeScore({ confidence: 1, timesUsed: 5, timesWorked: 5 })
    expect(media).toBeCloseTo(0.95) // 0.6 + 0.3 + 0.05
  })

  test('fracaso total: solo madurez (los usos fallidos cuentan 0.1)', () => {
    // confianza 0 · 0.6 = 0; ratio 0/10 · 0.3 = 0; madurez saturada · 0.1 = 0.1
    expect(knowledgeScore({ confidence: 0, timesUsed: 10, timesWorked: 0 })).toBeCloseTo(0.1)
  })

  test('pesos exactos de la fórmula (confianza 0.6, ratio 0.3, madurez 0.1)', () => {
    // confianza 0.5 · 0.6 = 0.3; ratio 4/8 = 0.5 · 0.3 = 0.15; usos 8/10 · 0.1 = 0.08
    expect(knowledgeScore({ confidence: 0.5, timesUsed: 8, timesWorked: 4 })).toBeCloseTo(0.53)
  })

  test('el ratio de éxito manda dentro de la misma confianza', () => {
    const efectiva = knowledgeScore({ confidence: 0.6, timesUsed: 10, timesWorked: 10 })
    const falla = knowledgeScore({ confidence: 0.6, timesUsed: 10, timesWorked: 2 })
    expect(efectiva).toBeGreaterThan(falla)
  })

  test('el resultado queda siempre en [0, 1] con datos sanos (worked ≤ used)', () => {
    for (let used = 0; used <= 12; used++) {
      for (let worked = 0; worked <= used; worked++) {
        for (const conf of [0, 0.25, 0.55, 0.95, 1]) {
          const s = knowledgeScore({ confidence: conf, timesUsed: used, timesWorked: worked })
          expect(s).toBeGreaterThanOrEqual(0)
          expect(s).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Proveedor LLM — prioridad, caché y enmascarado
// ─────────────────────────────────────────────────────────────

const ENV_KEYS = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL'] as const
let envOriginal: Record<string, string | undefined> = {}

beforeEach(() => {
  envOriginal = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  invalidateProviderCache()
})

afterAll(async () => {
  // Limpieza defensiva de la BD local y del entorno
  await db.setting.deleteMany({ where: { key: { in: ['llm.base_url', 'llm.api_key', 'llm.model'] } } })
  for (const k of ENV_KEYS) {
    if (envOriginal[k] === undefined) delete process.env[k]
    else process.env[k] = envOriginal[k]
  }
  invalidateProviderCache()
})

describe('enmascarado de claves (maskKey)', () => {
  test('clave vacía → cadena vacía', () => {
    expect(maskKey('')).toBe('')
  })

  test('claves cortas (≤ 8) se ocultan por completo', () => {
    expect(maskKey('abc123')).toBe('••••••••')
    expect(maskKey('12345678')).toBe('••••••••')
  })

  test('claves largas: 4 primeros + 8 puntos + 4 últimos', () => {
    expect(maskKey('sk-abcdef1234567890')).toBe('sk-a••••••••7890')
  })
})

describe('prioridad de lectura (BD → env → z-ai)', () => {
  test('con variables de entorno: source env, barra final de baseUrl eliminada', async () => {
    process.env.OPENAI_API_KEY = 'clave-de-prueba-123'
    process.env.OPENAI_BASE_URL = 'https://api.ejemplo.com/v1/'
    delete process.env.OPENAI_MODEL
    invalidateProviderCache()

    const cfg = await getProviderConfig()
    expect(cfg.source).toBe('env')
    expect(cfg.apiKey).toBe('clave-de-prueba-123')
    expect(cfg.baseUrl).toBe('https://api.ejemplo.com/v1')
    expect(cfg.model).toBe('gpt-4o-mini') // modelo por defecto
  })

  test('sin env y sin BD: cae al SDK integrado', async () => {
    for (const k of ENV_KEYS) delete process.env[k]
    invalidateProviderCache()

    const cfg = await getProviderConfig()
    expect(cfg.source).toBe('zai')
    expect(cfg.model).toBe('z-ai-sdk')
    expect(cfg.apiKey).toBe('')
  })

  test('la caché evita releer y la invalidación explícita la rompe', async () => {
    process.env.OPENAI_API_KEY = 'clave-primera'
    invalidateProviderCache()
    const primera = await getProviderConfig()
    process.env.OPENAI_API_KEY = 'clave-segunda'
    const cacheada = await getProviderConfig()
    expect(cacheada).toBe(primera) // misma referencia: TTL vigente
    expect(cacheada.apiKey).toBe('clave-primera')

    invalidateProviderCache()
    const fresca = await getProviderConfig()
    expect(fresca).not.toBe(primera)
    expect(fresca.apiKey).toBe('clave-segunda')
    delete process.env.OPENAI_API_KEY
  })

  test('guardado en BD: prioridad real, apiKey en blanco conserva la actual, limpieza posterior', async () => {
    // Sin BD y sin env sería 'zai'; con BD y sin env, tras guardar → 'db'
    for (const k of ENV_KEYS) delete process.env[k]
    invalidateProviderCache()
    const antes = await getProviderConfig()
    expect(antes.source).toBe('zai')

    const guardada = await saveProviderConfig({
      baseUrl: 'https://api.test.local/v1/',
      apiKey: '  clave-local-9876  ',
      model: 'modelo-test',
    })
    expect(guardada.source).toBe('db')
    expect(guardada.baseUrl).toBe('https://api.test.local/v1')
    expect(guardada.apiKey).toBe('clave-local-9876') // recortada
    expect(guardada.model).toBe('modelo-test')

    // Guardar con apiKey vacía conserva la actual
    const conservada = await saveProviderConfig({ baseUrl: 'https://api.test.local/v2', apiKey: '', model: 'modelo-test' })
    expect(conservada.apiKey).toBe('clave-local-9876')
    expect(conservada.baseUrl).toBe('https://api.test.local/v2')

    // Lectura directa vuelve a priorizar la BD
    invalidateProviderCache()
    const leida = await getProviderConfig()
    expect(leida.source).toBe('db')
    expect(leida.model).toBe('modelo-test')
  })
})
