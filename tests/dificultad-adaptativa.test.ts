// ─────────────────────────────────────────────────────────────
// Tests de la dificultad adaptativa (src/lib/sim/pace.ts +
// prisma/schema.prisma + src/lib/sim/engine.ts + ruta POST)
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />
//
// Tarea ROADMAP dificultad-adaptativa [M]: ajustar la fuerza de la
// defensa según el historial de victorias del escenario, CON TOPE y
// DESACTIVABLE. Contrato fijado aquí:
//
//   · ajusteDefensivo: banda [0.85, 1.15]; con menos de 5 resueltas
//     (RED+BLUE) NO hay señal (ajuste 1, activa false); los empates
//     no dan dirección (los recoge el veredicto global de
//     balance-drift); respuesta lineal alrededor del equilibrio 0.5.
//   · impactoRedAjustado / gananciaAzulAjustada: ajuste CERO-SUMA,
//     con IDENTIDAD exacta en ajuste = 1 (el comportamiento previo
//     queda intacto) y normalización defensiva (no finitos → 1,
//     fuera de banda → tope). El blindaje fijo (+2) NO viaja en la
//     ganancia ajustada: lo añade el motor, contrato de la
//     telemetría (round-progression).
//   · La fila de la campaña congela lo EFECTIVO: el multiplicador
//     se calcula UNA vez en startCampaign; determinista lo deja
//     neutro de serie (la reproducibilidad exacta de
//     seed-determinista no admite parámetros dependientes del
//     archivo al lanzar).
//   · PATCH_BONUS_COMPROMETIDO = 10: el antiguo +10 hardcodeado de
//     bestPatchTarget, ahora constante documentada — regla TÁCTICA
//     de elección de objetivo, no escalada por el ajuste.
// ─────────────────────────────────────────────────────────────

import { afterAll, describe, expect, mock, test } from 'bun:test'

// ── Aislamiento del proceso de tests (bun test = un proceso) ──
//
// Los lanzamientos reales de este fichero (startCampaign) pasan por
// la sonda LLM del motor. Sin este bloque, la sonda crearía el
// cliente REAL de z-ai-web-dev-sdk y llm.ts lo cachea a nivel de
// módulo (zaiPromise), lo que rompería el mock de los ficheros
// llm-creation/llm-resilience (se ejecutan después de este por
// orden alfabético y exigen un SDK caído). Proveedor externo
// inalcanzable + SDK mockeado caído: la sonda resuelve null rápido
// y las campañas de este fichero corren en SIM — que es justo lo
// que su contrato prueba (el congelado del ajuste no depende del
// modo del motor).
process.env.OPENAI_API_KEY = 'sk-test-unreachable'
process.env.OPENAI_BASE_URL = 'https://127.0.0.1:9' // puerto discard: conexión rechazada inmediata
process.env.OPENAI_MODEL = 'test-model'
mock.module('z-ai-web-dev-sdk', () => ({
  default: {
    create: () => {
      throw new Error('mock: z-ai no disponible en este test')
    },
  },
}))

import {
  ajusteDefensivo,
  gananciaAzulAjustada,
  impactoRedAjustado,
  normalizarAjuste,
  PATCH_BONUS_COMPROMETIDO,
  DEF_AJUSTE_MAX,
  DEF_AJUSTE_MIN,
  DEF_MUESTRA_MIN,
  BLUE_GAIN_BY_VERDICT,
  RED_IMPACT_BY_SEVERITY,
} from '../src/lib/sim/pace'
import { acceptAdaptativa, startCampaign } from '../src/lib/sim/engine'
import { bestPatchTarget } from '../src/lib/sim/engine-combate'
import { db } from '../src/lib/db'
import { cleanupLab } from '../src/lib/lab/store'

// Nodo mínimo con el contrato COMPLETO que bootLab desreferencia
// (H-006: la infraestructura de los escenarios de lanzamiento real
// debe ser utilizable — la vacía ya no pasa la validación).
const INFRA_VALIDA =
  '{"nodes":[{"id":"n1","name":"Servicio test","type":"WEB","ip":"10.0.0.10","segment":"DMZ","criticality":3,"vulnerabilities":["CVE-TEST-1"],"controls":[]}]}'

// ── 1. ajusteDefensivo: banda, muestra y empates ────────────

describe('dificultad-adaptativa · cálculo del ajuste (pace.ts)', () => {
  test('sin historial no hay señal: neutra y sin cuota', () => {
    const r = ajusteDefensivo([])
    expect(r.ajuste).toBe(1)
    expect(r.activa).toBe(false)
    expect(r.cuotaRed).toBeNull()
    expect(r.red).toBe(0)
    expect(r.blue).toBe(0)
    expect(r.empates).toBe(0)
  })

  test(`con menos de ${DEF_MUESTRA_MIN} resueltas no se congela ningún sesgo`, () => {
    // 4 RED de 4: señal fuerte pero muestra insuficiente → ruido
    const r = ajusteDefensivo([{ winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }])
    expect(r.activa).toBe(false)
    expect(r.ajuste).toBe(1)
    expect(r.cuotaRed).toBe(1)
  })

  test('los empates no cuentan como muestra direccional (H-003: los recoge balance-drift)', () => {
    // 4 RED + 5 empates: sin las 5 resueltas mínimas → neutra
    const corta = ajusteDefensivo([
      { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' },
      { winner: 'DRAW' }, { winner: 'DRAW' }, { winner: 'DRAW' }, { winner: 'DRAW' }, { winner: 'DRAW' },
    ])
    expect(corta.activa).toBe(false)
    expect(corta.ajuste).toBe(1)

    // muestra suficiente de empates puros: tampoco mueve el ajuste
    const tablas = ajusteDefensivo(Array.from({ length: 10 }, () => ({ winner: 'DRAW' })))
    expect(tablas.activa).toBe(false)
    expect(tablas.ajuste).toBe(1)
    expect(tablas.cuotaRed).toBeNull()
  })

  test('RED dominante refuerza la defensa hasta el tope; BLUE dominante la flexibiliza al suelo', () => {
    const roja = ajusteDefensivo(Array.from({ length: 6 }, () => ({ winner: 'RED' })))
    expect(roja.activa).toBe(true)
    expect(roja.ajuste).toBe(DEF_AJUSTE_MAX)

    const azul = ajusteDefensivo(Array.from({ length: 6 }, () => ({ winner: 'BLUE' })))
    expect(azul.activa).toBe(true)
    expect(azul.ajuste).toBe(DEF_AJUSTE_MIN)
  })

  test('equilibrio exacto devuelve neutro aunque la muestra baste', () => {
    const r = ajusteDefensivo([
      { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' },
      { winner: 'BLUE' }, { winner: 'BLUE' }, { winner: 'BLUE' },
    ])
    expect(r.activa).toBe(true)
    expect(r.ajuste).toBe(1)
    expect(r.cuotaRed).toBe(0.5)
  })

  test('respuesta lineal alrededor del equilibrio (pendiente documentada)', () => {
    // 6 RED / 2 BLUE → cuota 0.75 → 1 + 0.25 × 0.30 = 1.075
    const r = ajusteDefensivo([
      { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' },
      { winner: 'BLUE' }, { winner: 'BLUE' },
    ])
    expect(r.ajuste).toBe(1.075)

    // 10 RED / 5 BLUE → cuota 2/3 → 1 + (1/6) × 0.30 ≈ 1.05
    const leve = ajusteDefensivo([
      ...Array.from({ length: 10 }, () => ({ winner: 'RED' })),
      ...Array.from({ length: 5 }, () => ({ winner: 'BLUE' })),
    ])
    expect(leve.ajuste).toBe(1.05)

    // 5 RED / 10 BLUE → cuota 1/3 → 0.95
    const contra = ajusteDefensivo([
      ...Array.from({ length: 5 }, () => ({ winner: 'RED' })),
      ...Array.from({ length: 10 }, () => ({ winner: 'BLUE' })),
    ])
    expect(contra.ajuste).toBe(0.95)
  })

  test('los empates de una muestra grande no desplazan la cuota', () => {
    const filas = [
      { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' },
      { winner: 'BLUE' }, { winner: 'BLUE' }, { winner: 'BLUE' },
      ...Array.from({ length: 30 }, () => ({ winner: 'DRAW' as string | null })),
      { winner: null },
    ]
    expect(ajusteDefensivo(filas).ajuste).toBe(1)
  })

  test('monótona creciente en la cuota RED y siempre dentro de la banda', () => {
    let previo = -Infinity
    for (let red = 0; red <= 10; red++) {
      const filas = [
        ...Array.from({ length: red }, () => ({ winner: 'RED' })),
        ...Array.from({ length: 10 - red }, () => ({ winner: 'BLUE' })),
      ]
      const r = ajusteDefensivo(filas)
      expect(r.ajuste).toBeGreaterThanOrEqual(DEF_AJUSTE_MIN)
      expect(r.ajuste).toBeLessThanOrEqual(DEF_AJUSTE_MAX)
      expect(r.ajuste).toBeGreaterThanOrEqual(previo)
      previo = r.ajuste
    }
  })

  test('determinista: mismas filas → mismo ajuste', () => {
    const filas = [{ winner: 'RED' }, { winner: 'RED' }, { winner: 'BLUE' }, { winner: 'DRAW' }]
    expect(ajusteDefensivo(filas)).toEqual(ajusteDefensivo([...filas]))
  })

  test('ganadores desconocidos o nulos cuentan como empates (criterio del donut de /analitica)', () => {
    const r = ajusteDefensivo([
      { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' }, { winner: 'RED' },
      { winner: null }, { winner: 'RARO' },
    ] as Array<{ winner: string | null }>)
    expect(r.empates).toBe(2)
    expect(r.red).toBe(5)
    expect(r.activa).toBe(true)
    expect(r.ajuste).toBe(DEF_AJUSTE_MAX)
  })
})

// ── 2. normalización defensiva del multiplicador ────────────

describe('dificultad-adaptativa · normalización del multiplicador', () => {
  test('no finitos o no positivos degradan a neutro (fila dañada jamás sesga)', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -1]) {
      expect(normalizarAjuste(v)).toBe(1)
    }
  })

  test('valores fuera de banda se acotan al tope/suelo; dentro, pasan intactos', () => {
    expect(normalizarAjuste(99)).toBe(DEF_AJUSTE_MAX)
    expect(normalizarAjuste(0.1)).toBe(DEF_AJUSTE_MIN)
    expect(normalizarAjuste(1.075)).toBe(1.075)
    expect(normalizarAjuste(0.95)).toBe(0.95)
  })
})

// ── 3. escalas ajustadas: identidad en neutro, cero-suma fuera ──

describe('dificultad-adaptativa · escalas de impacto ajustadas', () => {
  test('identidad EXACTA con ajuste neutro en toda la tabla RED', () => {
    for (const base of Object.values(RED_IMPACT_BY_SEVERITY)) {
      for (const critFactor of [0.8, 1.0, 1.2]) {
        for (const damp of [0, 0.25, 0.6]) {
          const bruto = base * critFactor * (1 - damp)
          expect(impactoRedAjustado(bruto, 1)).toBe(Math.round(bruto))
        }
      }
    }
    // y con la fila dañada también (normalización a neutro)
    expect(impactoRedAjustado(9.3, Number.NaN)).toBe(Math.round(9.3))
  })

  test('identidad EXACTA con ajuste neutro en toda la tabla BLUE', () => {
    for (const [verdict, gain] of Object.entries(BLUE_GAIN_BY_VERDICT)) {
      expect(gananciaAzulAjustada(verdict, 1)).toBe(gain)
    }
    // veredicto desconocido degrada a la ganancia de IGNORADO (regla previa `?? 1`)
    expect(gananciaAzulAjustada('EXTRANO', 1)).toBe(1)
  })

  test('defensa reforzada (×1.15): BLUE gana lo que RED pierde (cero-suma)', () => {
    const bloqueo = gananciaAzulAjustada('BLOQUEADO', 1.15)
    expect(bloqueo).toBe(Math.round(5 * 1.15))
    expect(bloqueo).toBeGreaterThan(5)
    // el RED impacta menos: 12 × 0.85 = 10.2 → 10
    expect(impactoRedAjustado(12, 1.15)).toBe(10)
    // la ganancia ajustada NO incluye el blindaje fijo (+2): lo añade el motor
    expect(bloqueo).toBe(6)
  })

  test('defensa flexibilizada (×0.85): RED recupera lo que BLUE cede', () => {
    expect(gananciaAzulAjustada('BLOQUEADO', 0.85)).toBe(Math.round(5 * 0.85))
    // 12 × 1.15 = 13.8 → 14
    expect(impactoRedAjustado(12, 0.85)).toBe(14)
  })

  test('la banda protege a las escalas aunque el multiplicador llegue viciado', () => {
    // un ajuste 3.0 en la fila no triplica a nadie: se acota al tope
    expect(gananciaAzulAjustada('BLOQUEADO', 3)).toBe(gananciaAzulAjustada('BLOQUEADO', DEF_AJUSTE_MAX))
    expect(impactoRedAjustado(12, 3)).toBe(impactoRedAjustado(12, DEF_AJUSTE_MAX))
    expect(impactoRedAjustado(12, -2)).toBe(impactoRedAjustado(12, 1))
  })
})

// ── 4. validación del interruptor (ruta POST) ───────────────

describe('dificultad-adaptativa · validación del interruptor', () => {
  test('solo booleanos; otro tipo → null (la ruta responde 400)', () => {
    expect(acceptAdaptativa(true)).toBe(true)
    expect(acceptAdaptativa(false)).toBe(false)
    expect(acceptAdaptativa('false')).toBeNull()
    expect(acceptAdaptativa(0)).toBeNull()
    expect(acceptAdaptativa(null)).toBeNull()
    expect(acceptAdaptativa(undefined)).toBeNull()
  })
})

// ── 5. bonus táctico de parcheo: constante extraída, regla intacta ──

describe('dificultad-adaptativa · PATCH_BONUS_COMPROMETIDO', () => {
  test('el antiguo +10 hardcodeado vale 10 y conserva la prioridad documentada', () => {
    expect(PATCH_BONUS_COMPROMETIDO).toBe(10)
    // nodo tocado de criticidad 3 (13) gana a uno limpio de criticidad 5 —
    // contrato ya fijado en tests/engine.test.ts; se replica aquí como
    // evidencia de que la extracción no cambió la elección.
    const lab = {
      nodes: new Map([
        ['tocado', { nodeId: 'tocado', name: 't', type: 'APP', segment: 'DMZ', ip: '10.0.0.1', criticality: 3, compromised: true, isolated: false, vulnerabilities: { v1: 'OPEN' }, sessions: [], controls: [], patches: [] }],
        ['limpio', { nodeId: 'limpio', name: 'l', type: 'APP', segment: 'DMZ', ip: '10.0.0.2', criticality: 5, compromised: false, isolated: false, vulnerabilities: { v2: 'OPEN' }, sessions: [], controls: [], patches: [] }],
      ]),
      journal: [],
      sessions: new Map(),
    } as unknown as Parameters<typeof bestPatchTarget>[0]
    expect(bestPatchTarget(lab)).toEqual({ nodeId: 'tocado', vuln: 'v1' })
  })
})

// ── 6. la fila congela lo EFECTIVO (BD real, limpieza garantizada) ──

describe('dificultad-adaptativa · congelado en la fila (startCampaign)', () => {
  const MARCA_A = 'dif-adap-test-red'
  const MARCA_B = 'dif-adap-test-blue'
  let escenarioA = ''
  let escenarioB = ''
  const creadas: string[] = []

  const esperarFueraDeRUNNING = async (id: string, ms = 60_000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const fila = await db.campaign.findUnique({ where: { id } })
      if (fila && fila.status !== 'RUNNING') return fila
      await new Promise((r) => setTimeout(r, 400))
    }
    // no debe llegar aquí: si llega, el siguiente arranque chocaría
    await db.campaign.update({ where: { id }, data: { status: 'ABORTED', endedAt: new Date() } })
    throw new Error(`la campaña ${id} siguió RUNNING demasiado tiempo`)
  }

  afterAll(async () => {
    for (const id of creadas) {
      try { cleanupLab(id) } catch { /* el lab pudo no arrancar */ }
    }
    // Las campañas de este fichero corren su ciclo completo (H-006:
    // la infraestructura vacía ya no es lanzable) — las COMPLETED
    // escriben lecciones enlazadas a la fila; se retiran antes de
    // borrar las campañas para no dejar basura en el archivo.
    await db.knowledge.deleteMany({ where: { campaignId: { in: creadas } } })
    await db.campaign.deleteMany({ where: { scenarioId: { in: [escenarioA, escenarioB] } } })
    await db.scenario.deleteMany({ where: { key: { in: [MARCA_A, MARCA_B] } } })
    await db.$disconnect()
  })

  test('escenarios mínimos e historiales sembrados (limpieza garantizada)', async () => {
    for (const [key, codename] of [[MARCA_A, 'OP-DifAdap-Red'], [MARCA_B, 'OP-DifAdap-Blue']] as const) {
      await db.scenario.create({
        data: {
          key,
          codename,
          company: 'Test Corp',
          industry: 'test',
          difficulty: 1,
          description: key,
          // H-006: la infraestructura DEBE ser lanzable — la vacía
          // ('{"nodes":[]}') ya no supera la validación del arranque
          // (era el fallo que el hallazgo corrige; el bucle "abortaba
          // rápido" explotando ese crash). Nodo mínimo con el contrato
          // completo que bootLab desreferencia; el bucle corre el
          // ciclo SIM completo y la limpieza retira fila y lecciones.
          infrastructure: INFRA_VALIDA,
          redObjective: 'test',
          blueObjective: 'test',
        },
      })
    }
    const a = await db.scenario.findUnique({ where: { key: MARCA_A } })
    const b = await db.scenario.findUnique({ where: { key: MARCA_B } })
    escenarioA = a!.id
    escenarioB = b!.id

    // Escenario A: 6 victorias RED → defensa reforzada al tope.
    // Escenario B: 6 victorias BLUE → defensa flexibilizada al suelo.
    const historialA = Array.from({ length: 6 }, () => ({ scenarioId: escenarioA, status: 'COMPLETED', winner: 'RED', narrative: MARCA_A }))
    const historialB = Array.from({ length: 6 }, () => ({ scenarioId: escenarioB, status: 'COMPLETED', winner: 'BLUE', narrative: MARCA_B }))
    await db.campaign.createMany({ data: [...historialA, ...historialB] })
    expect(await db.campaign.count({ where: { scenarioId: escenarioA, status: 'COMPLETED' } })).toBe(6)
  }, 30_000)

  test('historial RED dominante congela ajusteDefensa = tope; por defecto adaptativa activa', async () => {
    await db.campaign.updateMany({ where: { status: 'RUNNING', scenarioId: escenarioA }, data: { status: 'ABORTED' } })
    const c = await startCampaign(escenarioA, undefined, false, true)
    creadas.push(c.id)
    expect(c.adaptativa).toBe(true)
    expect(c.ajusteDefensa).toBe(DEF_AJUSTE_MAX)
    const fila = await esperarFueraDeRUNNING(c.id)
    expect(fila.ajusteDefensa).toBe(DEF_AJUSTE_MAX)
  }, 90_000)

  test('{adaptativa:false} congela neutro aunque el historial pida refuerzo', async () => {
    await db.campaign.updateMany({ where: { status: 'RUNNING', scenarioId: escenarioA }, data: { status: 'ABORTED' } })
    const c = await startCampaign(escenarioA, undefined, true, false)
    creadas.push(c.id)
    expect(c.adaptativa).toBe(false)
    expect(c.ajusteDefensa).toBe(1)
    await esperarFueraDeRUNNING(c.id)
  }, 90_000)

  test('determinista deja la adaptativa neutra de serie (reproducibilidad exacta intacta)', async () => {
    await db.campaign.updateMany({ where: { status: 'RUNNING', scenarioId: escenarioA }, data: { status: 'ABORTED' } })
    // se PIDE adaptativa y hay historial RED dominante: lo EFECTIVO es neutro
    const c = await startCampaign(escenarioA, 2026, true, true)
    creadas.push(c.id)
    expect(c.determinista).toBe(true)
    expect(c.adaptativa).toBe(false)
    expect(c.ajusteDefensa).toBe(1)
    await esperarFueraDeRUNNING(c.id)
  }, 90_000)

  test('historial BLUE dominante congela ajusteDefensa = suelo', async () => {
    await db.campaign.updateMany({ where: { status: 'RUNNING', scenarioId: escenarioB }, data: { status: 'ABORTED' } })
    const c = await startCampaign(escenarioB, undefined, false, true)
    creadas.push(c.id)
    expect(c.ajusteDefensa).toBe(DEF_AJUSTE_MIN)
    const fila = await esperarFueraDeRUNNING(c.id)
    expect(fila.adaptativa).toBe(true)
    expect(fila.ajusteDefensa).toBe(DEF_AJUSTE_MIN)
  }, 90_000)

  test('defaults del esquema: filas nuevas adaptativa=true y ajusteDefensa=1', async () => {
    const c = await db.campaign.create({ data: { scenarioId: escenarioA, narrative: MARCA_A } })
    const fila = await db.campaign.findUnique({ where: { id: c.id } })
    expect(fila?.adaptativa).toBe(true)
    expect(fila?.ajusteDefensa).toBe(1)
    await db.campaign.delete({ where: { id: c.id } })
  })
})
