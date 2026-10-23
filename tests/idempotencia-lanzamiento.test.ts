// ─────────────────────────────────────────────────────────────
// Tests del cierre de servidor del doble clic (idempotencia-lanzamiento)
//
// Hipótesis [verificar] CONFIRMADA antes de implementar: 6 POST
// concurrentes a /api/campaigns creaban 2 campañas RUNNING
// simultáneas (TOCTOU entre findFirst y create en startCampaign).
// Aquí se fija el contrato de las dos piezas del cierre:
//
//   · src/lib/sim/launch-lock.ts — la puerta serializa tareas
//     concurrentes aunque se envían en el mismo tick; el error de
//     una tarea se propaga a su llamador pero NO rompe la cola.
//   · src/app/api/campaigns/idempotencia.ts — llave explícita
//     (Idempotency-Key, ventana 10 min) > hash del cuerpo (ventana
//     corta 5 s); solo se archiva el 200; memoria acotada.
// ─────────────────────────────────────────────────────────────

import { describe, expect, test } from 'bun:test'
import { createLaunchGate } from '../src/lib/sim/launch-lock'
import {
  BODY_WINDOW_MS,
  KEY_TTL_MS,
  MAX_ENTRIES,
  clearLaunches,
  findLaunch,
  recordLaunch,
  resolveDedupeKey,
} from '../src/app/api/campaigns/idempotencia'

// ── launch-lock ─────────────────────────────────────────────

describe('launch-lock · serialización del arranque', () => {
  test('las tareas concurrentes se ejecutan en serie, una a una', async () => {
    const gate = createLaunchGate()
    const log: string[] = []
    const tarea = (nombre: string, ms: number) => async () => {
      log.push(`inicio:${nombre}`)
      await new Promise((r) => setTimeout(r, ms))
      log.push(`fin:${nombre}`)
      return nombre
    }
    // Se envían TODAS en el mismo tick (como 6 POST concurrentes).
    const resultados = await Promise.all([
      gate(tarea('a', 15)),
      gate(tarea('b', 5)),
      gate(tarea('c', 10)),
    ])
    expect(resultados).toEqual(['a', 'b', 'c'])
    // Cada fin precede al inicio del siguiente — intercalado prohibido.
    expect(log).toEqual([
      'inicio:a', 'fin:a',
      'inicio:b', 'fin:b',
      'inicio:c', 'fin:c',
    ])
  })

  test('el error de una tarea se propaga a su llamador pero la cola sigue', async () => {
    const gate = createLaunchGate()
    const trasError = gate(async () => {
      throw new Error('fallo deliberado')
    })
    const trasBueno = gate(async () => 'recuperado')
    await expect(trasError).rejects.toThrow('fallo deliberado')
    expect(await trasBueno).toBe('recuperado')
  })

  test('el orden de llegada fija el orden de ejecución (justo, FIFO)', async () => {
    const gate = createLaunchGate()
    const orden: number[] = []
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        gate(async () => {
          orden.push(i)
        }),
      ),
    )
    expect(orden).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

// ── idempotencia ────────────────────────────────────────────

const HEADERS_CON = (clave: string) => new Headers({ 'Idempotency-Key': clave })

describe('idempotencia · resolveDedupeKey', () => {
  test('la Idempotency-Key explícita tiene precedencia sobre el cuerpo', () => {
    const h = HEADERS_CON('reintento-1')
    const k1 = resolveDedupeKey(h, { scenarioId: 'a' })
    const k2 = resolveDedupeKey(h, { scenarioId: 'b' })
    expect(k1).toBe('key:reintento-1')
    expect(k1).toBe(k2) // la llave agrupa aunque el cuerpo difiera
  })

  test('sin header, cuerpos idénticos → misma llave; distintos → distinta', () => {
    const h = new Headers()
    const a1 = resolveDedupeKey(h, {})
    const a2 = resolveDedupeKey(h, {})
    const b = resolveDedupeKey(h, { scenarioId: 'esc-x' })
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
    expect(a1?.startsWith('body:')).toBe(true)
  })

  test('cuerpo ausente se normaliza a {} (mismo lanzamiento que el POST vacío)', () => {
    const h = new Headers()
    const sinCuerpo = resolveDedupeKey(h, undefined)
    const vacío = resolveDedupeKey(h, {})
    expect(sinCuerpo).toBe(vacío)
  })

  test('header vacío cae al hash del cuerpo; desbordado → null (no dedupe)', () => {
    // Headers recorta el valor: '   ' llega como '' → tratado como ausente.
    const espacios = resolveDedupeKey(HEADERS_CON('   '), {})
    const sinHeader = resolveDedupeKey(new Headers(), {})
    expect(espacios).toBe(sinHeader)
    expect(espacios).not.toBeNull()
    expect(resolveDedupeKey(HEADERS_CON('k'.repeat(129)), {})).toBeNull()
    expect(resolveDedupeKey(HEADERS_CON('k'.repeat(128)), {})).not.toBeNull()
  })
})

describe('idempotencia · archivo de respuestas', () => {
  const T0 = 1_000_000

  test('record + find dentro de la ventana → replay; la body: caduca en 5 s', () => {
    clearLaunches()
    const key = resolveDedupeKey(new Headers(), { scenarioId: 'esc' })!
    recordLaunch(key, 200, { ok: true, campaignId: 'c1' }, T0)
    const hit = findLaunch(key, T0 + BODY_WINDOW_MS - 1)
    expect(hit).toEqual({ status: 200, body: { ok: true, campaignId: 'c1' }, storedAt: T0 })
    expect(findLaunch(key, T0 + BODY_WINDOW_MS)).toBeNull() // ventana inclusiva: al segundo exacto, fuera
  })

  test('la key: explícita vive 10 min, no 5 s', () => {
    clearLaunches()
    const key = 'key:operacion-larga'
    recordLaunch(key, 200, { ok: true, campaignId: 'c2' }, T0)
    expect(findLaunch(key, T0 + BODY_WINDOW_MS + 1)).not.toBeNull()
    expect(findLaunch(key, T0 + KEY_TTL_MS - 1)).not.toBeNull()
    expect(findLaunch(key, T0 + KEY_TTL_MS)).toBeNull()
  })

  test('solo se archivan respuestas 200 (un 409/500 no se reproduce)', () => {
    clearLaunches()
    recordLaunch('key:fracaso', 409, { ok: false }, T0)
    recordLaunch('key:error', 500, { ok: false }, T0)
    expect(findLaunch('key:fracaso', T0 + 1)).toBeNull()
    expect(findLaunch('key:error', T0 + 1)).toBeNull()
  })

  test('la memoria está acotada a MAX_ENTRIES (purga al insertar)', () => {
    clearLaunches()
    for (let i = 0; i < MAX_ENTRIES + 25; i++) {
      recordLaunch(`key:vieja-${i}`, 200, { i }, T0 + i)
    }
    // Todas vivas (ttl 10 min, iteramos 5 s de reloj simulado): el tope manda.
    let vivas = 0
    for (let i = 0; i < MAX_ENTRIES + 25; i++) {
      if (findLaunch(`key:vieja-${i}`, T0 + MAX_ENTRIES + 25)) vivas++
    }
    expect(vivas).toBeLessThanOrEqual(MAX_ENTRIES)
    // Las más viejas son las expulsadas (FIFO) — las últimas siguen.
    expect(findLaunch(`key:vieja-${MAX_ENTRIES + 24}`, T0 + MAX_ENTRIES + 25)).not.toBeNull()
    expect(findLaunch('key:vieja-0', T0 + MAX_ENTRIES + 25)).toBeNull()
  })

  test('contrato de ventanas exportado (auditable desde el roadmap)', () => {
    expect(BODY_WINDOW_MS).toBe(5_000)
    expect(KEY_TTL_MS).toBe(10 * 60_000)
  })
})
