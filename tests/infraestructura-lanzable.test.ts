// ─────────────────────────────────────────────────────────────
// Tests de la infraestructura LANZABLE (H-006 — motor aborta en
// silencio con un escenario cuya infrastructure no trae nodos).
//
// Repro del hallazgo (TEST, iterando el arnés de e2e-actualizacion-bd):
// un escenario con infrastructure='{"nodes":[]}' en BD sostenía el 200
// del POST y ~2 s después la campaña moría ABORTED en silencio
// (nodes[…].id sobre undefined; la causa solo en el log del servidor).
// Camino real: BD importada de otra versión/instancia o edición manual.
//
// Contrato fijado aquí:
//   · parsearInfraestructura (puro): null ante JSON malformado, nodes
//     ausente/vacío o nodos que no cumplen el contrato que bootLab
//     desreferencia sin guardia (id, type, segment, criticality,
//     vulnerabilities, controls); el objeto parseado si TODO el grafo
//     es utilizable.
//   · elegirEscenarioLanzable (puro): el azar solo recae sobre
//     escenarios sostenibles; el id de un no-lanzable →
//     ESCENARIO_INVALIDO (existe, no sirve — nunca «inexistente»);
//     id inexistente → SCENARIO_NOT_FOUND (H-004 intacto); sin
//     NINGUNO lanzable → SIN_ESCENARIOS_VALIDOS.
//   · POST /api/campaigns: 400 clasificado con la causa, sin side
//     effects (el rechazo es ANTES del create).
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, describe, expect, test } from 'bun:test'
import {
  elegirEscenarioLanzable,
  parsearInfraestructura,
  resolverEscenario,
} from '../src/lib/sim/engine-select'

// Entorno ANTES de importar la ruta (molde superficie-mutaciones).
process.env.ADMIN_TOKEN ??= 'token-infraestructura-lanzable'
process.env.TRUST_PROXY ??= '1'

type PostHandler = (req: Request) => Promise<Response>
const { POST } = (await import('../src/app/api/campaigns/route')) as unknown as { POST: PostHandler }
const { db } = await import('../src/lib/db')

const TOKEN = process.env.ADMIN_TOKEN!
let xffSeq = 0
const xffNuevo = () => `10.71.${xffSeq % 254}.${(xffSeq++ * 11) % 254}`

const callPost = (body: string) =>
  POST(
    new Request('http://127.0.0.1:3000/api/campaigns', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3000',
        'x-forwarded-for': xffNuevo(),
        'x-admin-token': TOKEN,
        'content-type': 'application/json',
      },
      body,
    })
  )

// Los cuerpos de error no fuga pilas, rutas ni internals (patrón
// entorno-adverso e2e).
const FUGAS = [' at ', '.ts:', 'node_modules', '/home/z', 'PrismaClient']
const sinFuga = (s: string) => !FUGAS.some((m) => s.includes(m))

// Nodo completo — exactamente el contrato que bootLab consume.
const NODO = {
  id: 'n1',
  name: 'Servicio test',
  type: 'WEB',
  ip: '10.0.0.10',
  segment: 'DMZ',
  criticality: 3,
  vulnerabilities: ['CVE-TEST-1'],
  controls: [],
}

const escape = (o: unknown) => JSON.stringify(o)

// ── parsearInfraestructura (puro) ────────────────────────────

describe('H-006 · parsearInfraestructura — lo que la BD no puede sostener', () => {
  test('el repro exacto del hallazgo: {"nodes":[]} → null', () => {
    expect(parsearInfraestructura('{"nodes":[]}')).toBeNull()
  })

  test('JSON malformado, no-objeto o nodes ausente/no-array → null', () => {
    expect(parsearInfraestructura('no-es-json')).toBeNull()
    expect(parsearInfraestructura('{}')).toBeNull()
    expect(parsearInfraestructura('null')).toBeNull()
    expect(parsearInfraestructura('42')).toBeNull()
    expect(parsearInfraestructura('{"infra":"sin nodes"}')).toBeNull()
    expect(parsearInfraestructura('{"nodes":null}')).toBeNull()
    expect(parsearInfraestructura('{"nodes":"no-soy-array"}')).toBeNull()
  })

  test('nodo que no es objeto, sin id o con id vacío → null', () => {
    expect(parsearInfraestructura(escape({ nodes: [42] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [null] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, id: undefined }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, id: '' }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, id: 7 }] }))).toBeNull()
  })

  test('nodo sin type/segment/criticality → null (bootLab los desreferencia)', () => {
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, type: undefined }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, segment: undefined }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, criticality: undefined }] }))).toBeNull()
  })

  test('nodo sin vulnerabilities/controls (o no-array) → null (bootLab hace .map/.some)', () => {
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, vulnerabilities: undefined }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, controls: undefined }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, vulnerabilities: 'no-array' }] }))).toBeNull()
    expect(parsearInfraestructura(escape({ nodes: [{ ...NODO, controls: 'no-array' }] }))).toBeNull()
  })

  test('basta que UN nodo falle para rechazar TODO el grafo', () => {
    expect(parsearInfraestructura(escape({ nodes: [NODO, { id: 'n2', name: 'sin más campos' }] }))).toBeNull()
  })

  test('infraestructura válida → el objeto parseado con nodes intactos', () => {
    const infra = parsearInfraestructura(escape({ nodes: [NODO] }))
    expect(infra).not.toBeNull()
    expect(infra?.nodes).toHaveLength(1)
    expect(infra?.nodes[0]).toEqual(NODO)
  })
})

// ── elegirEscenarioLanzable (puro) ───────────────────────────

describe('H-006 · elegirEscenarioLanzable — el azar solo sobre lo sostenible', () => {
  const valido1 = { id: 'esc-valido-1', infrastructure: escape({ nodes: [NODO] }) }
  const valido2 = { id: 'esc-valido-2', infrastructure: escape({ nodes: [{ ...NODO, id: 'n2' }] }) }
  const roto = { id: 'esc-roto', infrastructure: '{"nodes":[]}' }
  const catalogo = [valido1, roto, valido2]
  const soloRotos = [
    { id: 'roto-a', infrastructure: '{"nodes":[]}' },
    { id: 'roto-b', infrastructure: 'no-es-json' },
  ]

  test('azar (sin id, "" o random) → SIEMPRE un escenario del pool válido', () => {
    for (const id of [undefined, '', 'random']) {
      for (let i = 0; i < 12; i++) {
        const elegido = elegirEscenarioLanzable(catalogo, id)
        expect(['esc-valido-1', 'esc-valido-2']).toContain(elegido.id)
      }
    }
  })

  test('id de un escenario lanzable → ese exacto', () => {
    expect(elegirEscenarioLanzable(catalogo, 'esc-valido-2').id).toBe('esc-valido-2')
  })

  test('id existente pero NO lanzable → ESCENARIO_INVALIDO con el id en el mensaje', () => {
    try {
      elegirEscenarioLanzable(catalogo, 'esc-roto')
      expect.unreachable()
    } catch (err) {
      const e = err as Error & { code?: string }
      expect(e.code).toBe('ESCENARIO_INVALIDO')
      expect(e.message).toContain('esc-roto')
      expect(e.message).toContain('infraestructura')
    }
  })

  test('id inexistente → SCENARIO_NOT_FOUND (H-004 intacto, diagnóstico verdadero)', () => {
    try {
      elegirEscenarioLanzable(catalogo, 'escenario-inexistente')
      expect.unreachable()
    } catch (err) {
      const e = err as Error & { code?: string }
      expect(e.code).toBe('SCENARIO_NOT_FOUND')
      expect(e.message).toContain('escenario-inexistente')
    }
  })

  test('resolverEscenario SIN catálogo conserva el comportamiento histórico', () => {
    // Compatibilidad de la firma previa (2 args): id inexistente sigue
    // siendo SCENARIO_NOT_FOUND, no un falso ESCENARIO_INVALIDO.
    const lista = [{ id: 'a' }, { id: 'b' }]
    expect(resolverEscenario(lista, 'a').id).toBe('a')
    try {
      resolverEscenario(lista, 'no-existo')
      expect.unreachable()
    } catch (err) {
      expect((err as Error & { code?: string }).code).toBe('SCENARIO_NOT_FOUND')
    }
  })

  test('SOLO escenarios no lanzables → SIN_ESCENARIOS_VALIDOS (con id y sin id)', () => {
    for (const id of [undefined, 'roto-a', 'random']) {
      try {
        elegirEscenarioLanzable(soloRotos, id)
        expect.unreachable()
      } catch (err) {
        const e = err as Error & { code?: string }
        expect(e.code).toBe('SIN_ESCENARIOS_VALIDOS')
        expect(e.message).toContain('Ningún escenario')
      }
    }
  })
})

// ── POST /api/campaigns — rechazo clasificado, sin side effects ──

describe('H-006 · POST /api/campaigns — escenario marcado no lanzable', () => {
  const MARCA = 'h006-infra-rota-test'
  let rotoId = ''

  afterAll(async () => {
    // El rechazo no lanza campañas (todo ocurre antes del create): solo
    // retira el escenario marcado y desconecta el cliente compartido.
    await db.scenario.deleteMany({ where: { key: MARCA } })
    await db.$disconnect()
  }, 20_000)

  test('escenario con {"nodes":[]} en BD → 400 con la causa, sin campaña', async () => {
    const esc = await db.scenario.create({
      data: {
        key: MARCA,
        codename: 'OP-H006-Rota',
        company: 'Test Corp',
        industry: 'test',
        difficulty: 1,
        description: MARCA,
        // El repro EXACTO del hallazgo: infraestructura sin nodos.
        infrastructure: '{"nodes":[]}',
        redObjective: 'test',
        blueObjective: 'test',
      },
    })
    rotoId = esc.id

    const antes = await db.campaign.count()
    const res = await callPost(JSON.stringify({ scenarioId: rotoId, determinista: true, seed: 33 }))
    const json = (await res.json()) as { ok: boolean; error?: string }
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    // El operador ve el IDENTIFICADOR que envió (el id, no el key —
    // es lo que viaja en scenarioId y lo que puede corregir).
    expect(json.error).toContain(rotoId)
    expect(json.error).toContain('infraestructura')
    // NINGUNA campaña lanzada (antes: 200 + ABORTED silencioso).
    expect(await db.campaign.count()).toBe(antes)
    expect(sinFuga(JSON.stringify(json))).toBe(true)
  })

  test('el id malformado PERO inexistente sigue siendo SCENARIO_NOT_FOUND (400)', async () => {
    const res = await callPost(JSON.stringify({ scenarioId: 'h006-no-existo' }))
    const json = (await res.json()) as { ok: boolean; error?: string }
    expect(res.status).toBe(400)
    expect(json.error).toContain('h006-no-existo')
    expect(json.error).toContain('inexistente')
  })
})
