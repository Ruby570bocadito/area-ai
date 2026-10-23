// ─────────────────────────────────────────────────────────────
// Tests de la validación de entradas del lanzamiento (H-004,
// casos 1 y 2 restantes — verificación DIR en primera persona).
//
// Contrato fijado aquí (molde acceptSeed — «no se silencia»):
//
//   · resolverEscenario (engine-select.ts): el azar queda EXPLÍCITO
//     — sin id, '' o 'random' eligen al azar; un id pedido y no
//     encontrado lanza SCENARIO_NOT_FOUND (nunca degrada a aleatorio
//     en silencio: pedir un escenario concreto y obtener otro es la
//     misma promesa rota que una semilla sustituida).
//   · POST /api/campaigns: JSON malformado → 400 «Cuerpo JSON
//     inválido» (antes caía al azar); sin cuerpo sigue admitido
//     ({} del reader vacío de readJsonBody); 'too-large' sigue 413.
//   · El rechazo NO tiene side effects: ocurre antes del create —
//     sin fila de campaña, sin bucle en segundo plano, sin lab.
//     Por eso este fichero NO lanza campañas reales: el camino del
//     azar ({}) ya lo cubren golden-path e2e y smoke, y aquí se
//     fija el de los rechazos, que es el nuevo.
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, describe, expect, test } from 'bun:test'
import { resolverEscenario } from '../src/lib/sim/engine-select'

// Entorno ANTES de importar la ruta (molde superficie-mutaciones):
// el token activa las barreras R4 y TRUST_PROXY aísla el cubo de cada
// petición vía X-Forwarded-For. DATABASE_URL de reserva para entornos
// sin .env (los tests consultan BD real: ensureSeed en startCampaign).
process.env.ADMIN_TOKEN ??= 'token-validacion-lanzamiento'
process.env.TRUST_PROXY ??= '1'

// Importación dinámica: los módulos con cliente Prisma se instancian
// tras fijar el entorno (los imports estáticos de arriba no tocan BD).
type PostHandler = (req: Request) => Promise<Response>
const { POST } = (await import('../src/app/api/campaigns/route')) as unknown as { POST: PostHandler }
const { db } = await import('../src/lib/db')

const TOKEN = process.env.ADMIN_TOKEN!
let xffSeq = 0
const xffNuevo = () => `10.54.${xffSeq % 254}.${(xffSeq++ * 13) % 254}`

const callPost = (body: string | undefined) => {
  const headers: Record<string, string> = {
    host: '127.0.0.1:3000',
    'x-forwarded-for': xffNuevo(),
    'x-admin-token': TOKEN,
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  return POST(new Request('http://127.0.0.1:3000/api/campaigns', { method: 'POST', headers, body }))
}

// Los cuerpos de error no fugar pilas, rutas ni internals (patrón
// entorno-adverso e2e).
const FUGAS = [' at ', '.ts:', 'node_modules', '/home/z', 'PrismaClient']
const sinFuga = (s: string) => !FUGAS.some((m) => s.includes(m))

// ── Caso 1 · resolverEscenario (puro, sin BD) ───────────────

describe('H-004 caso 1 · resolverEscenario — el azar solo explícito', () => {
  const lista = [{ id: 'esc-a' }, { id: 'esc-b' }, { id: 'esc-c' }]

  test('sin id, cadena vacía o random → un escenario de la lista (azar explícito)', () => {
    // 12 pasadas: el azar puede devolver cualquiera, SIEMPRE de la lista.
    for (const id of [undefined, '', 'random']) {
      for (let i = 0; i < 12; i++) {
        const elegido = resolverEscenario(lista, id)
        expect(lista.some((s) => s.id === elegido.id)).toBe(true)
      }
    }
  })

  test('id existente → ese escenario exacto (el pedido, no otro)', () => {
    expect(resolverEscenario(lista, 'esc-b').id).toBe('esc-b')
    expect(resolverEscenario(lista, 'esc-a').id).toBe('esc-a')
  })

  test('id inexistente → SCENARIO_NOT_FOUND con el id en el mensaje', () => {
    try {
      resolverEscenario(lista, 'escenario-inexistente')
      expect.unreachable()
    } catch (err) {
      const e = err as Error & { code?: string }
      expect(e.code).toBe('SCENARIO_NOT_FOUND')
      expect(e.message).toContain('escenario-inexistente')
    }
  })

  test('id más largo que el eco → el mensaje lo trunca (sin cuerpos kilométricos)', () => {
    const idLargo = 'x'.repeat(300)
    try {
      resolverEscenario(lista, idLargo)
      expect.unreachable()
    } catch (err) {
      const e = err as Error
      expect(e.message.length).toBeLessThanOrEqual('Escenario inexistente: '.length + 80)
      expect(e.message.startsWith('Escenario inexistente: xxx')).toBe(true)
    }
  })

  test('id de tipo erróneo (número) → SCENARIO_NOT_FOUND legible, nunca TypeError interno', () => {
    // Un JSON {scenarioId: 123} no debe reventar .slice con TypeError
    // (sería un 500 sin motivo) ni degradar a azar como antes.
    try {
      resolverEscenario(lista, 123 as unknown as string)
      expect.unreachable()
    } catch (err) {
      const e = err as Error & { code?: string }
      expect(e.code).toBe('SCENARIO_NOT_FOUND')
      expect(e.message).toContain('123')
    }
  })
})

// ── Caso 2 · la ruta rechaza con 400 (contra la BD real) ────

describe('H-004 caso 2 · POST /api/campaigns — rechazo explícito, sin side effects', () => {
  const campañas = () => db.campaign.count()

  afterAll(async () => {
    // Este fichero no lanza campañas (todo rechaza antes del create):
    // solo desconecta el cliente compartido del proceso de tests.
    await db.$disconnect()
  }, 20_000)

  test('JSON malformado → 400 «Cuerpo JSON inválido», sin campaña y sin fuga', async () => {
    const antes = await campañas()
    const res = await callPost('{json-malformado')
    const json = (await res.json()) as { ok: boolean; error?: string }
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toBe('Cuerpo JSON inválido')
    expect(await campañas()).toBe(antes) // NINGUNA campaña lanzada
    expect(sinFuga(JSON.stringify(json))).toBe(true)
  })

  test('scenarioId inexistente → 400 con el id recibido, sin campaña', async () => {
    const antes = await campañas()
    const res = await callPost(JSON.stringify({ scenarioId: 'h004-id-mal-copiado' }))
    const json = (await res.json()) as { ok: boolean; error?: string }
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toContain('h004-id-mal-copiado') // el despistado VE qué llegó
    expect(await campañas()).toBe(antes) // el rechazo ocurre antes del create
    expect(sinFuga(JSON.stringify(json))).toBe(true)
  })

  test('scenarioId de tipo erróneo (número) → 400 legible, no 500 y no azar', async () => {
    const antes = await campañas()
    const res = await callPost(JSON.stringify({ scenarioId: 123 }))
    const json = (await res.json()) as { ok: boolean; error?: string }
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toContain('123')
    expect(await campañas()).toBe(antes)
  })

  test('la semilla inválida sigue ganando al escenario (orden del molde acceptSeed intacto)', async () => {
    // El criterio de seed-determinista: primero se validan los campos
    // escalares; el error menciona la semilla, no el escenario.
    const res = await callPost(JSON.stringify({ scenarioId: 'h004-no-existe', seed: 'no-soy-un-número' }))
    const json = (await res.json()) as { ok: boolean; error?: string }
    expect(res.status).toBe(400)
    expect(json.error).toContain('Semilla inválida')
  })
})
