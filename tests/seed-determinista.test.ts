// ─────────────────────────────────────────────────────────────
// Tests de la semilla por campaña (src/lib/sim/engine.ts +
// prisma/schema.prisma + src/app/api/campaigns/route.ts)
//
// Tarea ROADMAP seed-determinista [M]: la semilla del RNG se
// GUARDA en la fila de la campaña — es lo único que permite
// reproducir una campaña pasada (el RNG global se pierde en cada
// reinicio). Contrato fijado aquí:
//
//   · newCampaignSeed: entero 31 bits, inyectable (con rand fija
//     es determinista; por defecto Math.random, nunca engineRoll —
//     sembrar la semilla con el propio RNG la correlacionaría).
//   · acceptSeed: enteros [0, 2^31-1]; lo inválido → null (la ruta
//     responde 400 en vez de silenciar la intención del usuario).
//   · Schema: Campaign.seed nullable (filas históricas sin semilla
//     son legítimas y el motor las respeta con Math.random).
//   · El replay con la misma semilla produce la MISMA secuencia de
//     tiradas (mulberry32, ya fijado en tests/engine.test.ts).
// ─────────────────────────────────────────────────────────────

import { afterAll, describe, expect, test } from 'bun:test'
import { acceptDeterminista, acceptSeed, engineRollProbe, newCampaignSeed, SEED_MAX, setEngineSeed } from '../src/lib/sim/engine'
import { db } from '../src/lib/db'

describe('seed-determinista · generación', () => {
  test('con rand inyectada es determinista y entero en [0, 2^31-1]', () => {
    const fija = () => 0.123456789
    const a = newCampaignSeed(fija)
    const b = newCampaignSeed(fija)
    expect(a).toBe(b)
    expect(Number.isInteger(a)).toBe(true)
    expect(a).toBe(Math.floor(0.123456789 * SEED_MAX))
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(SEED_MAX)
  })

  test('rand extrema 0.9999… no desborda SEED_MAX', () => {
    expect(newCampaignSeed(() => 0.999999)).toBeLessThan(SEED_MAX)
    expect(newCampaignSeed(() => 0)).toBe(0)
  })

  test('por defecto usa Math.random y respeta el rango (100 muestras)', () => {
    for (let i = 0; i < 100; i++) {
      const s = newCampaignSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(SEED_MAX)
    }
  })
})

describe('seed-determinista · validación de la semilla del cliente', () => {
  test('acepta enteros del rango completo, incluido 0 y el tope', () => {
    expect(acceptSeed(0)).toBe(0)
    expect(acceptSeed(1)).toBe(1)
    expect(acceptSeed(SEED_MAX)).toBe(SEED_MAX)
    expect(acceptSeed(2026)).toBe(2026)
  })

  test('rechaza lo no entero, fuera de rango o de otro tipo → null', () => {
    expect(acceptSeed(-1)).toBeNull()
    expect(acceptSeed(SEED_MAX + 1)).toBeNull()
    expect(acceptSeed(2 ** 53)).toBeNull()
    expect(acceptSeed(3.14)).toBeNull()
    expect(acceptSeed(NaN)).toBeNull()
    expect(acceptSeed(Infinity)).toBeNull()
    expect(acceptSeed('42')).toBeNull()
    expect(acceptSeed(null)).toBeNull()
    expect(acceptSeed(undefined)).toBeNull()
    expect(acceptSeed({ seed: 42 })).toBeNull()
  })
})

describe('seed-determinista · interruptor determinista', () => {
  test('solo booleanos; otro tipo → null (la ruta responde 400)', () => {
    expect(acceptDeterminista(true)).toBe(true)
    expect(acceptDeterminista(false)).toBe(false)
    expect(acceptDeterminista('true')).toBeNull()
    expect(acceptDeterminista(1)).toBeNull()
    expect(acceptDeterminista(null)).toBeNull()
    expect(acceptDeterminista(undefined)).toBeNull()
  })
})

describe('seed-determinista · la semilla vive en la BD', () => {
  const MARCA = 'seed-test-tmp'
  let escenarioId = ''

  afterAll(async () => {
    await db.campaign.deleteMany({ where: { narrative: MARCA } })
    await db.scenario.deleteMany({ where: { key: MARCA } })
    await db.$disconnect()
  })

  test('escenario mínimo para la relación (limpieza garantizada)', async () => {
    const esc = await db.scenario.create({
      data: {
        key: MARCA,
        codename: 'OP-Seed-Test',
        company: 'Test Corp',
        industry: 'test',
        difficulty: 1,
        description: MARCA,
        infrastructure: '{"nodes":[]}',
        redObjective: 'test',
        blueObjective: 'test',
      },
    })
    escenarioId = esc.id
    expect(escenarioId).toBeTruthy()
  })

  test('campaign.create persiste la semilla y la devuelve intacta', async () => {
    const c = await db.campaign.create({
      data: { scenarioId: escenarioId, narrative: MARCA, seed: 2026 },
    })
    const leida = await db.campaign.findUnique({ where: { id: c.id } })
    expect(leida?.seed).toBe(2026)
    await db.campaign.delete({ where: { id: c.id } })
  })

  test('las filas históricas sin semilla (null) son representables', async () => {
    const c = await db.campaign.create({
      data: { scenarioId: escenarioId, narrative: MARCA },
    })
    const leida = await db.campaign.findUnique({ where: { id: c.id } })
    expect(leida?.seed).toBeNull()
    await db.campaign.delete({ where: { id: c.id } })
  })

  test('reproducibilidad: la misma semilla produce la MISMA secuencia de tiradas', () => {
    setEngineSeed(2026)
    const primera = Array.from({ length: 32 }, () => engineRollProbe())
    setEngineSeed(2026)
    const segunda = Array.from({ length: 32 }, () => engineRollProbe())
    expect(segunda).toEqual(primera)
    // semillas distintas → secuencias distintas (misma longitud)
    setEngineSeed(2027)
    const tercera = Array.from({ length: 32 }, () => engineRollProbe())
    expect(tercera).not.toEqual(primera)
    // sin semilla se restaura Math.random: tiradas no sembradas no son repetibles
    setEngineSeed()
    const sinA = engineRollProbe()
    setEngineSeed()
    const sinB = engineRollProbe()
    expect(sinA).not.toBe(sinB) // casi seguro; dos Math.random idénticos seguidos son un evento 2^-52
  })
})
