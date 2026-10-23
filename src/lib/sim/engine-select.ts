// ─────────────────────────────────────────────────────────────
// engine-select — selección de agentes y de nodos objetivo.
//
// Extraído de engine.ts (refactor-engine-fases) sin cambiar
// comportamiento. Rotación de agentes por fase para que todos
// participen, especialistas BLUE por tipo de operación
// defensiva y elección de nodo objetivo según la fase.
// Contrato fijado en tests/engine.test.ts.
// ─────────────────────────────────────────────────────────────

import type { db } from '@/lib/db'
import { RED_AGENTS, BLUE_AGENTS } from './roster'
import { rand } from './engine-rng'
import type { Phase, InfraNode, Infrastructure } from './types'

export type AgentRow = Awaited<ReturnType<typeof db.agent.findMany>>[number]

/** Mapa agentKey → fases en las que toma la iniciativa (definido en el roster) */
const AGENT_PHASES = new Map<string, Phase[]>(
  [...RED_AGENTS, ...BLUE_AGENTS].map((a) => [a.key, a.phases])
)

/** Especialistas BLUE por tipo de operación defensiva */
const BLUE_OP_AGENTS: Record<string, string[]> = {
  BLOCK: ['blue-bastion', 'blue-citadel'],
  ISOLATE: ['blue-bastion'],
  PATCH: ['blue-bastion', 'blue-citadel'],
  MONITOR: ['blue-oracle', 'blue-argus'],
  HUNT: ['blue-sentinel'],
}

/** Elige el agente de la fase, rotando entre los que comparten fase para que todos participen */
export function pickAgentForPhase<T extends { key: string }>(agents: T[], phase: Phase, round: number): T {
  const matches = agents.filter((a) => (AGENT_PHASES.get(a.key) ?? []).includes(phase))
  if (matches.length === 0) return agents[0]
  return matches[(round - 1) % matches.length]
}

export function pickAgentForOp<T extends { key: string }>(agents: T[], op: string, phase: Phase, round: number): T {
  const prefs = BLUE_OP_AGENTS[op] ?? []
  for (const key of prefs) {
    const found = agents.find((a) => a.key === key)
    if (found) return found
  }
  return pickAgentForPhase(agents, phase, round)
}

/** Nodo objetivo por fase: DMZ al inicio, activos críticos en OBJETIVO, todo el alcance en el resto. */
export function pickNodeForPhase(nodes: InfraNode[], phase: Phase): InfraNode {
  const pool =
    phase === 'RECON' || phase === 'ARMADO'
      ? nodes.filter((n) => n.segment === 'DMZ')
      : phase === 'OBJETIVO'
        ? nodes.filter((n) => n.criticality >= 4)
        : nodes
  const list = pool.length > 0 ? pool : nodes
  return rand(list)
}

/**
 * Resuelve el escenario de una campaña por el `scenarioId` del cliente.
 *
 * Contrato (H-004, molde acceptSeed — «no se silencia»): pedir un
 * escenario CONCRETO y obtener otro al azar es la misma promesa rota
 * que pedir una semilla concreta y recibir otra. El azar queda
 * EXPLÍCITO y solo por las vías de siempre:
 *
 *   · sin `scenarioId`, cadena vacía o `scenarioId: 'random'` → azar
 *     (comportamiento previo del POST {} y del autopiloto, que no pide
 *     escenario; 'random' lo documenta en la propia petición).
 *   · un id que NO existe lanza `SCENARIO_NOT_FOUND` — la ruta lo
 *     convierte en 400 con el id recibido (la ruta decide el copy).
 *   · un id que existe en el `catalogo` completo pero quedó FUERA del
 *     pool recibido lanza `ESCENARIO_INVALIDO` (H-006) — decir
 *     «inexistente» sería un diagnóstico falso para el operador; el
 *     escenario está, pero no es lanzable. Con el parámetro omitido
 *     el catálogo ES el pool y el comportamiento es el histórico.
 */
export function resolverEscenario<T extends { id: string }>(scenarios: T[], scenarioId?: string, catalogo: T[] = scenarios): T {
  if (!scenarioId || scenarioId === 'random') return rand(scenarios)
  const encontrada = scenarios.find((s) => s.id === scenarioId)
  if (encontrada) return encontrada
  if (catalogo !== scenarios && catalogo.some((s) => s.id === scenarioId)) {
    // El id llega de JSON sin validar el tipo (molde del cuerpo del POST):
    // String() blinda el eco — un scenarioId número u objeto responde 400
    // legible, nunca un TypeError interno (que sería un 500 sin motivo).
    const err = new Error(`El escenario ${String(scenarioId).slice(0, 80)} existe pero su infraestructura no es lanzable (nodes vacíos o malformados)`) as Error & { code?: string }
    err.code = 'ESCENARIO_INVALIDO'
    throw err
  }
  const err = new Error(`Escenario inexistente: ${String(scenarioId).slice(0, 80)}`) as Error & { code?: string }
  err.code = 'SCENARIO_NOT_FOUND'
  throw err
}

// ─────────────────────────────────────────────────────────────
// H-006 — infraestructura LANZABLE (motor-aborta-silencioso)
//
// Un escenario cuya `infrastructure` almacenada no trae nodos
// utilizables sostenía el 200 del POST y ~2 s después moría
// ABORTED en silencio (nodes[…].id sobre undefined; la causa solo
// quedaba en el log del servidor). Camino real: BD importada de
// otra versión/instancia (e2e-actualizacion-bd) o edición manual.
// La validación ocurre ANTES del create: el rechazo es clasificado
// (400/503 con causa legible) y sin side effects.
//
// El contrato por nodo es EXACTAMENTE el que la ruta de arranque
// desreferencia sin guardia (bootLab en lab/store.ts): id, type,
// segment, criticality, vulnerabilities y controls — cualquier
// campo ausente de esa lista revienta el bucle a mitad de campaña.
// ─────────────────────────────────────────────────────────────

/**
 * Parseo defensivo de la infraestructura almacenada del escenario.
 * Devuelve null cuando la BD trae algo que el motor no puede
 * sostener: JSON malformado, `nodes` ausente, vacío, o entradas que
 * no cumplen el contrato que bootLab consume. Devuelve el objeto
 * parseado cuando TODO el grafo es utilizable.
 */
export function parsearInfraestructura(infrastructure: string): Infrastructure | null {
  try {
    const parsed = JSON.parse(infrastructure) as unknown
    if (parsed === null || typeof parsed !== 'object') return null
    const nodes = (parsed as { nodes?: unknown }).nodes
    if (!Array.isArray(nodes) || nodes.length === 0) return null
    for (const n of nodes) {
      if (n === null || typeof n !== 'object') return null
      const nodo = n as Partial<InfraNode>
      if (typeof nodo.id !== 'string' || nodo.id.length === 0) return null
      if (typeof nodo.type !== 'string' || typeof nodo.segment !== 'string') return null
      if (typeof nodo.criticality !== 'number' || !Number.isFinite(nodo.criticality)) return null
      if (!Array.isArray(nodo.vulnerabilities) || !Array.isArray(nodo.controls)) return null
    }
    return parsed as Infrastructure
  } catch {
    return null
  }
}

/**
 * Elige el escenario LANZABLE de una campaña (H-006).
 *
 *   · filtra los escenarios con infraestructura utilizable — el azar
 *     solo recae sobre los que el motor puede sostener;
 *   · un `scenarioId` pedido que existe pero no es lanzable →
 *     `ESCENARIO_INVALIDO` (400 con la causa, vía catálogo);
 *   · un id que no existe → `SCENARIO_NOT_FOUND` (H-004 intacto);
 *   · si NINGUNO es lanzable → `SIN_ESCENARIOS_VALIDOS` (503: es un
 *     problema de datos del servidor, no de la petición).
 */
export function elegirEscenarioLanzable<T extends { id: string; infrastructure: string }>(scenarios: T[], scenarioId?: string): T {
  const validos = scenarios.filter((s) => parsearInfraestructura(s.infrastructure) !== null)
  if (validos.length === 0) {
    const err = new Error('Ningún escenario tiene infraestructura utilizable: todos fallan la validación de nodes (BD importada o editada a mano)') as Error & { code?: string }
    err.code = 'SIN_ESCENARIOS_VALIDOS'
    throw err
  }
  return resolverEscenario(validos, scenarioId, scenarios)
}
