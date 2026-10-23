// ─────────────────────────────────────────────────────────────
// Tests de la recuperación de huérfanas en el lanzamiento (H-002)
//
// Ciclo verificado empíricamente en el hallazgo (persona #1
// administrador/operador, prioridad DIR 13ª pasada): matar el
// servidor a mitad de campaña deja la fila RUNNING en BD; la
// recuperación existía (recoverOrphanCampaigns, umbral 120 s sobre
// el último evento) pero SOLO se disparaba en GET /api/state — un
// cliente que solo hace POST recibía 409 indefinido.
//
// Contrato fijado aquí:
//   · POST /api/campaigns recupera huérfanas (RUNNING con >120 s
//     sin eventos) ANTES del chequeo RUNNING — el POST ya no depende
//     de que alguien abra /api/state. Idempotente y conservador:
//     las campañas VIVAS no se tocan (mismo umbral que /api/state).
//   · El 409 INFORMA: campaignId + enCursoDesde (ISO) de la campaña
//     en curso — el operador sabe QUÉ bloquea y DESDE CUÁNDO, no
//     un muro sin datos.
//   · recoverOrphanCampaigns es idempotente: una segunda pasada
//     sobre la misma BD no cambia nada (la huérfana ya está
//     ABORTED y las vivas siguen fuera del umbral).
//
// Lanzamiento REAL de campaña (molde dificultad-adaptativa): los
// cuerpos de cada POST llevan semilla distinta para no colisionar
// con la ventana de dedupe de cuerpo (5 s) y el aislamiento del
// SDK z-ai sigue la lección de bun test = un proceso (proveedor
// inalcanzable + SDK caído: SIM garantizado, cero llamadas LLM).
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, describe, expect, mock, test } from 'bun:test'

// Aislamiento del proceso de tests (molde dificultad-adaptativa):
// proveedor externo inalcanzable + SDK mockeado caído — la sonda
// resuelve null rápido y la campaña real de este fichero corre en
// SIM; el cliente REAL de z-ai nunca se instancia (rompería los
// mocks de llm-creation/llm-resilience, que corren después por
// orden alfabético).
process.env.OPENAI_API_KEY = 'sk-test-unreachable'
process.env.OPENAI_BASE_URL = 'https://127.0.0.1:9'
process.env.OPENAI_MODEL = 'test-model'
mock.module('z-ai-web-dev-sdk', () => ({
  default: {
    create: () => {
      throw new Error('mock: z-ai no disponible en este test')
    },
  },
}))

// Barreras de la ruta de mutación + aislamiento del cubo rate-limit
// por petición vía X-Forwarded-For (molde superficie-mutaciones).
process.env.ADMIN_TOKEN ??= 'token-huerfanas-recuperacion'
process.env.TRUST_PROXY ??= '1'

type PostHandler = (req: Request) => Promise<Response>
const { POST } = (await import('../src/app/api/campaigns/route')) as unknown as { POST: PostHandler }
const { recoverOrphanCampaigns } = await import('../src/lib/sim/engine')
const { db } = await import('../src/lib/db')
const { cleanupLab } = await import('../src/lib/lab/store')

const MARCA = 'h002-huerfanas-test'
const TOKEN = process.env.ADMIN_TOKEN!
let xffSeq = 0
const xffNuevo = () => `10.62.${xffSeq % 254}.${(xffSeq++ * 17) % 254}`

// Infraestructura VÁLIDA de un nodo (contrato InfraNode completo):
// el lanzamiento real del test 1 corre el bucle SIM completo contra
// el laboratorio — un escenario sin nodos sería otro hallazgo (H-006).
const INFRA_VALIDA =
  '{"nodes":[{"id":"n1","name":"Servicio test","type":"WEB","ip":"10.0.0.10","segment":"DMZ","criticality":3,"vulnerabilities":["CVE-TEST-1"],"controls":[]}]}'

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

const esperarFueraDeRUNNING = async (id: string, ms = 90_000) => {
  const inicio = Date.now()
  while (Date.now() - inicio < ms) {
    const fila = await db.campaign.findUnique({ where: { id } })
    if (fila && fila.status !== 'RUNNING') return fila
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`la campaña ${id} siguió RUNNING demasiado tiempo`)
}

describe('H-002 · POST recupera huérfanas y el 409 informa', () => {
  let escenarioId = ''
  const lanzados: string[] = []

  afterAll(async () => {
    for (const id of lanzados) {
      try { cleanupLab(id) } catch { /* el lab pudo no arrancar */ }
    }
    // Las lecciones de la campaña lanzada apuntan a la fila (FK
    // opcional): se retiran antes de borrar las campañas.
    await db.knowledge.deleteMany({ where: { campaignId: { in: lanzados } } })
    await db.campaign.deleteMany({ where: { scenarioId: escenarioId } })
    await db.scenario.deleteMany({ where: { key: MARCA } })
    await db.$disconnect()
  }, 30_000)

  test('escenario válido marcado (limpieza garantizada)', async () => {
    const esc = await db.scenario.create({
      data: {
        key: MARCA,
        codename: 'OP-H002-Test',
        company: 'Test Corp',
        industry: 'test',
        difficulty: 1,
        description: MARCA,
        infrastructure: INFRA_VALIDA,
        redObjective: 'test',
        blueObjective: 'test',
      },
    })
    escenarioId = esc.id
    expect(escenarioId).toBeTruthy()
  })

  test('recoverOrphanCampaigns es idempotente (2ª pasada no cambia nada)', async () => {
    const orfana = await db.campaign.create({
      data: {
        scenarioId: escenarioId,
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 130_000),
        narrative: MARCA,
      },
    })
    await recoverOrphanCampaigns()
    const primera = await db.campaign.findUnique({ where: { id: orfana.id } })
    expect(primera?.status).toBe('ABORTED')
    expect(primera?.endedAt).not.toBeNull()
    await recoverOrphanCampaigns()
    const segunda = await db.campaign.findUnique({ where: { id: orfana.id } })
    expect(segunda?.status).toBe('ABORTED')
    await db.campaign.delete({ where: { id: orfana.id } })
  })

  test('huérfana vieja (>120 s sin eventos) NO bloquea el POST — se aborta y lanza', async () => {
    const orfana = await db.campaign.create({
      data: {
        scenarioId: escenarioId,
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 130_000),
        narrative: MARCA,
      },
    })
    const res = await callPost(JSON.stringify({ determinista: true, scenarioId: escenarioId, seed: 11 }))
    const json = (await res.json()) as { ok: boolean; campaignId?: string }
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.campaignId).toBeTruthy()
    lanzados.push(json.campaignId!)

    // La huérfana quedó cerrada con motivo y hora de cierre.
    const orfanaTras = await db.campaign.findUnique({ where: { id: orfana.id } })
    expect(orfanaTras?.status).toBe('ABORTED')
    expect(orfanaTras?.endedAt).not.toBeNull()

    // Higiene: la campaña lanzada corre su ciclo y deja la BD sin
    // RUNNING de este fichero (el cerrojo queda libre).
    const lanzada = await esperarFueraDeRUNNING(json.campaignId!)
    expect(lanzada.status).not.toBe('RUNNING')
  }, 120_000)

  test('campaña VIVA sigue bloqueando — pero el 409 informa id y enCursoDesde', async () => {
    const viva = await db.campaign.create({
      data: { scenarioId: escenarioId, status: 'RUNNING', startedAt: new Date(), narrative: MARCA },
    })
    const antes = await db.campaign.count({ where: { scenarioId: escenarioId } })

    // Semilla distinta del POST anterior: no colisiona con la ventana
    // de dedupe de cuerpo (5 s) — este POST debe llegar al chequeo.
    const res = await callPost(JSON.stringify({ determinista: true, scenarioId: escenarioId, seed: 22 }))
    const json = (await res.json()) as { ok: boolean; error?: string; campaignId?: string; enCursoDesde?: string }
    expect(res.status).toBe(409)
    expect(json.ok).toBe(false)
    expect(json.error).toBe('Ya hay una campaña en curso')
    // El 409 identifica QUÉ bloquea y DESDE CUÁNDO (ISO parseable,
    // igual al arranque de la fila viva — no un eco vacío).
    expect(json.campaignId).toBe(viva.id)
    expect(json.enCursoDesde).toBeTruthy()
    expect(new Date(json.enCursoDesde!).toISOString()).toBe(viva.startedAt.toISOString())

    // Sin side effects: la viva intacta y ninguna campaña nueva.
    const vivaTras = await db.campaign.findUnique({ where: { id: viva.id } })
    expect(vivaTras?.status).toBe('RUNNING')
    expect(await db.campaign.count({ where: { scenarioId: escenarioId } })).toBe(antes)
    await db.campaign.delete({ where: { id: viva.id } })
  })
})
