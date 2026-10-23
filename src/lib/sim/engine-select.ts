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
import type { Phase, InfraNode } from './types'

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
 */
export function resolverEscenario<T extends { id: string }>(scenarios: T[], scenarioId?: string): T {
  if (!scenarioId || scenarioId === 'random') return rand(scenarios)
  const encontrada = scenarios.find((s) => s.id === scenarioId)
  if (!encontrada) {
    // El id llega de JSON sin validar el tipo (molde del cuerpo del POST):
    // String() blinda el eco — un scenarioId número u objeto responde 400
    // legible, nunca un TypeError interno (que sería un 500 sin motivo).
    const err = new Error(`Escenario inexistente: ${String(scenarioId).slice(0, 80)}`) as Error & { code?: string }
    err.code = 'SCENARIO_NOT_FOUND'
    throw err
  }
  return encontrada
}
