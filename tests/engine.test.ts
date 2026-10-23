// ─────────────────────────────────────────────────────────────
// Tests del motor de campaña (src/lib/sim/engine.ts)
//
// Red de seguridad ANTES de refactorizar (tarea ALTA tests-engine
// del ROADMAP). Fija el contrato de las piezas puras del combate
// sin arrancar una campaña completa:
//
//   · Elección de agentes por fase — rotación entre especialistas
//     (pickAgentForPhase) y preferencia por operación defensiva
//     (pickAgentForOp), con el roster real como contrato.
//   · Momentum RED — decisión de encadenar (redShouldChain) con
//     las constantes de pace.ts como límites exactos.
//   · Respuesta BLUE — firma y segmento por fase, hipótesis de
//     caza, objetivo de parche real (bestPatchTarget) y ganancias
//     por veredicto.
//   · Progreso SIEMPRE en [0, 100] — accumulateProgress sobre la
//     escala cerrada de victory.ts (la evidencia "114/100" fue un
//     desbordamiento real: este contrato lo impide).
//   · RNG sembrado — setEngineSeed hace reproducibles las tiradas
//     del motor (base de seed-determinista); sin semilla el
//     comportamiento no cambia (Math.random).
//
// El cambio en engine.ts es mínimo y aditivo: exportación de
// ayudantes que ya existían, RNG sembrable y reutilización de
// clampProgress de victory.ts. Cero cambio de comportamiento.
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test'

import {
  accumulateProgress,
  bestPatchTarget,
  defaultSignatureFor,
  huntHypothesis,
  pickAgentForOp,
  pickAgentForPhase,
  pickNodeForPhase,
  redShouldChain,
  segmentForPhase,
  setEngineSeed,
} from '../src/lib/sim/engine'
import { RED_AGENTS, BLUE_AGENTS } from '../src/lib/sim/roster'
import { PHASE_ORDER, type InfraNode } from '../src/lib/sim/types'
import {
  BLUE_GAIN_BY_VERDICT,
  BLUE_HUNT_ROLL,
  CHAINABLE_PHASES,
  RED_CHAIN_ON_EXITO,
  RED_CHAIN_ON_PARCIAL,
} from '../src/lib/sim/pace'
import type { LabCampaignState, LabNodeState } from '../src/lib/lab/types'
import { clampProgress } from '../src/lib/victory'

// Restaurar Math.random tras cada test para no contaminar otras suites.
afterEach(() => setEngineSeed())
//
// NOTA: pickAgentForPhase/pickAgentForOp resuelven las fases en el mapa
// global AGENT_PHASES (construido del roster real), no en la propiedad
// `phases` de los objetos pasados. Por eso los tests operan con
// subconjuntos reales de RED_AGENTS/BLUE_AGENTS.

// ─────────────────────────────────────────────────────────────
// Utilidades de fabricación
// ─────────────────────────────────────────────────────────────

const mkInfra = (id: string, segment: string, type: string, criticality: number): InfraNode => ({
  id,
  name: id,
  type,
  ip: '127.0.0.1',
  segment,
  criticality,
  vulnerabilities: [],
  controls: [],
})

const NODOS: InfraNode[] = [
  mkInfra('web', 'DMZ', 'WEB', 3),
  mkInfra('api', 'DMZ', 'API', 4),
  mkInfra('db', 'CORE', 'DB', 5),
  mkInfra('ad', 'AD', 'AD', 4),
  mkInfra('ot', 'OT', 'OT', 5),
  mkInfra('backup', 'CORE', 'BACKUP', 4),
]

const mkNode = (nodeId: string, over: Partial<LabNodeState> = {}): LabNodeState => ({
  nodeId,
  segment: 'DMZ',
  type: 'WEB',
  criticality: 3,
  vulnerabilities: {},
  controls: [],
  compromised: false,
  isolated: false,
  patchesApplied: [],
  ...over,
})

const mkLab = (nodes: LabNodeState[]): LabCampaignState => ({
  campaignId: 't-engine',
  scenarioKey: 't',
  company: 't',
  bootedAt: new Date().toISOString(),
  round: 1,
  nodes: new Map(nodes.map((n) => [n.nodeId, n])),
  sessions: new Map(),
  journal: [],
  monitors: [],
  firewall: [],
  exfiltrated: [],
  seq: 0,
})

// ─────────────────────────────────────────────────────────────
// 1. Elección de agentes por fase
// ─────────────────────────────────────────────────────────────

describe('elección de agentes por fase (pickAgentForPhase)', () => {
  test('rota entre los especialistas de la fase según la ronda (roster real)', () => {
    // RECON tiene dos especialistas BLUE: rotación r1 → citadel, r2 → oracle
    expect(pickAgentForPhase(BLUE_AGENTS, 'RECON', 1).key).toBe('blue-citadel')
    expect(pickAgentForPhase(BLUE_AGENTS, 'RECON', 2).key).toBe('blue-oracle')
    expect(pickAgentForPhase(BLUE_AGENTS, 'RECON', 3).key).toBe('blue-citadel')
  })

  test('la rotación solo cuenta a los especialistas de la fase', () => {
    // blue-bastion (ESCALADA/OBJETIVO) NO es especialista de RECON: no altera la rotación
    const subset = BLUE_AGENTS.filter((a) => ['blue-citadel', 'blue-bastion'].includes(a.key))
    expect(pickAgentForPhase(subset, 'RECON', 1).key).toBe('blue-citadel')
    expect(pickAgentForPhase(subset, 'RECON', 2).key).toBe('blue-citadel')
    // con los dos especialistas reales de INTRUSION sí rota
    const intr = BLUE_AGENTS.filter((a) => ['blue-oracle', 'blue-argus'].includes(a.key))
    expect(pickAgentForPhase(intr, 'INTRUSION', 1).key).toBe('blue-oracle')
    expect(pickAgentForPhase(intr, 'INTRUSION', 2).key).toBe('blue-argus')
  })

  test('con un solo especialista, siempre el mismo', () => {
    const solo = [RED_AGENTS.find((a) => a.key === 'red-spectre')!]
    for (const round of [1, 2, 5, 12]) {
      expect(pickAgentForPhase(solo, 'RECON', round).key).toBe('red-spectre')
    }
  })

  test('sin especialistas de la fase en el subconjunto: cae al primer agente', () => {
    // red-spectre solo domina RECON: para LATERAL no hay especialista → fallback
    const solo = [RED_AGENTS.find((a) => a.key === 'red-spectre')!]
    expect(pickAgentForPhase(solo, 'LATERAL', 4).key).toBe('red-spectre')
  })

  test('contrato con el roster real: cada fase tiene especialista en ambos equipos', () => {
    const fases = [...new Set(PHASE_ORDER)]
    expect(fases).toHaveLength(6)
    for (const fase of fases) {
      const red = pickAgentForPhase(RED_AGENTS, fase, 1)
      const blue = pickAgentForPhase(BLUE_AGENTS, fase, 1)
      expect(red.phases).toContain(fase) // nunca cae al fallback agents[0]
      expect(blue.phases).toContain(fase)
    }
  })

  test('las dos rondas de una fase BLUE rotan de especialista (RECON e INTRUSION)', () => {
    expect(pickAgentForPhase(BLUE_AGENTS, 'RECON', 1).key).toBe('blue-citadel')
    expect(pickAgentForPhase(BLUE_AGENTS, 'RECON', 2).key).toBe('blue-oracle')
    expect(pickAgentForPhase(BLUE_AGENTS, 'INTRUSION', 1).key).toBe('blue-oracle')
    expect(pickAgentForPhase(BLUE_AGENTS, 'INTRUSION', 2).key).toBe('blue-argus')
  })

  test('las dos rondas de una fase RED mantienen al especialista único', () => {
    for (const [r1, r2] of [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]]) {
      const fase = PHASE_ORDER[r1 - 1]
      expect(pickAgentForPhase(RED_AGENTS, fase, r1).key).toBe(pickAgentForPhase(RED_AGENTS, fase, r2).key)
    }
  })
})

describe('elección de agente por operación defensiva (pickAgentForOp)', () => {
  test('cada operación tiene su especialista BLUE', () => {
    expect(pickAgentForOp(BLUE_AGENTS, 'BLOCK', 'ESCALADA', 1).key).toBe('blue-bastion')
    expect(pickAgentForOp(BLUE_AGENTS, 'ISOLATE', 'OBJETIVO', 1).key).toBe('blue-bastion')
    expect(pickAgentForOp(BLUE_AGENTS, 'PATCH', 'ARMADO', 1).key).toBe('blue-bastion')
    expect(pickAgentForOp(BLUE_AGENTS, 'MONITOR', 'RECON', 1).key).toBe('blue-oracle')
    expect(pickAgentForOp(BLUE_AGENTS, 'HUNT', 'LATERAL', 1).key).toBe('blue-sentinel')
  })

  test('operación desconocida: delega en la rotación por fase', () => {
    expect(pickAgentForOp(BLUE_AGENTS, 'OP_INEXISTENTE', 'RECON', 1).key).toBe('blue-citadel')
    expect(pickAgentForOp(BLUE_AGENTS, 'OP_INEXISTENTE', 'RECON', 2).key).toBe('blue-oracle')
  })

  test('preferencia cae al segundo especialista si el primero no está en el roster', () => {
    const soloCitadel = BLUE_AGENTS.filter((a) => a.key !== 'blue-bastion')
    expect(pickAgentForOp(soloCitadel, 'BLOCK', 'ESCALADA', 1).key).toBe('blue-citadel')
  })
})

// ─────────────────────────────────────────────────────────────
// 2. Momentum RED
// ─────────────────────────────────────────────────────────────

describe('momentum RED (redShouldChain)', () => {
  test('tras ÉXITO encadena con probabilidad alta (0.65, límite estricto)', () => {
    expect(RED_CHAIN_ON_EXITO).toBe(0.65)
    expect(redShouldChain('EXITO', 0.64)).toBe(true)
    expect(redShouldChain('EXITO', 0.65)).toBe(false) // roll < p, estricto
    expect(redShouldChain('EXITO', 0.99)).toBe(false)
  })

  test('tras PARCIAL encadena con momentum moderado (0.35)', () => {
    expect(RED_CHAIN_ON_PARCIAL).toBe(0.35)
    expect(redShouldChain('PARCIAL', 0.34)).toBe(true)
    expect(redShouldChain('PARCIAL', 0.35)).toBe(false)
  })

  test('tras FALLO nunca encadena', () => {
    expect(redShouldChain('FALLO', 0)).toBe(false)
    expect(redShouldChain('FALLO', 0.99)).toBe(false)
    expect(redShouldChain(undefined, 0)).toBe(false)
  })

  test('las fases de contacto inicial no encadenan (constantes de pace.ts)', () => {
    expect(CHAINABLE_PHASES).toEqual(['INTRUSION', 'ESCALADA', 'LATERAL', 'OBJETIVO'])
    expect(CHAINABLE_PHASES).not.toContain('RECON')
    expect(CHAINABLE_PHASES).not.toContain('ARMADO')
  })

  test('el turno proactivo de BLUE es una tirada acotada', () => {
    expect(BLUE_HUNT_ROLL).toBeGreaterThan(0)
    expect(BLUE_HUNT_ROLL).toBeLessThan(1)
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Respuesta BLUE
// ─────────────────────────────────────────────────────────────

describe('respuesta BLUE: telemetría por fase', () => {
  test('firma por defecto por fase', () => {
    expect(defaultSignatureFor('RECON')).toBe('PORT_SCAN')
    expect(defaultSignatureFor('ARMADO')).toBe('UNUSUAL_PATH')
    expect(defaultSignatureFor('INTRUSION')).toBe('SQLI')
    expect(defaultSignatureFor('ESCALADA')).toBe('PASS_THE_HASH')
    expect(defaultSignatureFor('LATERAL')).toBe('LATERAL_SMB')
    expect(defaultSignatureFor('OBJETIVO')).toBe('DATA_EXFIL')
  })

  test('segmento de monitorización por fase', () => {
    expect(segmentForPhase('RECON')).toBe('DMZ')
    expect(segmentForPhase('ARMADO')).toBe('DMZ')
    expect(segmentForPhase('INTRUSION')).toBe('DMZ')
    expect(segmentForPhase('ESCALADA')).toBe('CORE')
    expect(segmentForPhase('LATERAL')).toBe('CORE')
    expect(segmentForPhase('OBJETIVO')).toBe('CORE')
  })

  test('hipótesis de caza: presentes, no vacías y distintas por fase', () => {
    const fases = [...new Set(PHASE_ORDER)]
    const hipotesis = fases.map((f) => huntHypothesis(f))
    for (const h of hipotesis) expect(h.trim().length).toBeGreaterThan(0)
    expect(new Set(hipotesis).size).toBe(fases.length)
  })

  test('ganancia defensiva por veredicto: bloquear > contener > detectar > ignorar', () => {
    expect(BLUE_GAIN_BY_VERDICT['BLOQUEADO']).toBe(5)
    expect(BLUE_GAIN_BY_VERDICT['CONTENIDO']).toBe(4)
    expect(BLUE_GAIN_BY_VERDICT['DETECTADO']).toBe(3)
    expect(BLUE_GAIN_BY_VERDICT['ENDURECIDO']).toBe(3)
    expect(BLUE_GAIN_BY_VERDICT['IGNORADO']).toBe(1)
    for (const gain of Object.values(BLUE_GAIN_BY_VERDICT)) expect(gain).toBeGreaterThanOrEqual(1)
  })
})

describe('objetivo de parche real (bestPatchTarget)', () => {
  test('solo las vulnerabilidades OPEN son candidatas', () => {
    const lab = mkLab([
      mkNode('a', { vulnerabilities: { 'v-parcheada': 'PATCHED', 'v-abierta': 'OPEN' } }),
    ])
    expect(bestPatchTarget(lab)).toEqual({ nodeId: 'a', vuln: 'v-abierta' })
  })

  test('sin vulnerabilidades abiertas no hay objetivo', () => {
    expect(bestPatchTarget(mkLab([mkNode('a', { vulnerabilities: { v: 'PATCHED' } })]))).toEqual({})
    expect(bestPatchTarget(mkLab([mkNode('a')]))).toEqual({})
    expect(bestPatchTarget(mkLab([]))).toEqual({})
  })

  test('gana la mayor criticidad', () => {
    const lab = mkLab([
      mkNode('bajo', { criticality: 3, vulnerabilities: { v1: 'OPEN' } }),
      mkNode('alto', { criticality: 5, vulnerabilities: { v2: 'OPEN' } }),
    ])
    expect(bestPatchTarget(lab)).toEqual({ nodeId: 'alto', vuln: 'v2' })
  })

  test('un nodo comprometido prioriza sobre criticidad mayor limpia (+10)', () => {
    const lab = mkLab([
      mkNode('tocado', { criticality: 3, compromised: true, vulnerabilities: { v1: 'OPEN' } }),
      mkNode('limpio', { criticality: 5, vulnerabilities: { v2: 'OPEN' } }),
    ])
    expect(bestPatchTarget(lab)).toEqual({ nodeId: 'tocado', vuln: 'v1' })
  })

  test('la preferencia explícita manda si tiene candidata', () => {
    const lab = mkLab([
      mkNode('alto', { criticality: 5, vulnerabilities: { v1: 'OPEN' } }),
      mkNode('medio', { criticality: 3, vulnerabilities: { v2: 'OPEN' } }),
    ])
    expect(bestPatchTarget(lab, 'medio')).toEqual({ nodeId: 'medio', vuln: 'v2' })
  })

  test('la preferencia sin candidata cae al mejor global', () => {
    const lab = mkLab([
      mkNode('alto', { criticality: 5, vulnerabilities: { v1: 'OPEN' } }),
      mkNode('medio', { criticality: 3, vulnerabilities: { v2: 'PATCHED' } }),
    ])
    expect(bestPatchTarget(lab, 'medio')).toEqual({ nodeId: 'alto', vuln: 'v1' })
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Progreso siempre en [0, 100]
// ─────────────────────────────────────────────────────────────

describe('escala cerrada del progreso (accumulateProgress)', () => {
  test('acumula dentro de la escala', () => {
    expect(accumulateProgress(0, 20)).toBe(20)
    expect(accumulateProgress(42, 0)).toBe(42)
    expect(accumulateProgress(30, 15)).toBe(45)
  })

  test('acota por abajo y por arriba', () => {
    expect(accumulateProgress(0, -5)).toBe(0)
    expect(accumulateProgress(95, 10)).toBe(100)
    expect(accumulateProgress(99.5, 1)).toBe(100)
    expect(accumulateProgress(100, 0)).toBe(100)
  })

  test('el desbordamiento histórico (114/100) ya no es posible', () => {
    expect(accumulateProgress(99, 15)).toBe(100)
    expect(accumulateProgress(60, 54)).toBe(100)
  })

  test('coincide con clampProgress de victory.ts (fuente única)', () => {
    for (const [c, d] of [[0, 0], [10, -20], [70, 40], [99, 1], [100, -100], [3.5, 0.25]]) {
      expect(accumulateProgress(c, d)).toBe(clampProgress(c + d))
    }
  })

  test('valores no finitos degradan a 0 (contrato de clampProgress)', () => {
    expect(accumulateProgress(50, Number.NaN)).toBe(0)
    expect(accumulateProgress(Number.POSITIVE_INFINITY, 0)).toBe(0)
  })

  test('caminata aleatoria larga: el progreso nunca sale de [0, 100]', () => {
    let p = 0
    for (let i = 0; i < 1000; i++) {
      p = accumulateProgress(p, Math.round((Math.random() * 2 - 1) * 30))
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 5. RNG sembrado
// ─────────────────────────────────────────────────────────────

describe('RNG sembrado (setEngineSeed + pickNodeForPhase)', () => {
  test('misma semilla produce exactamente la misma secuencia de objetivos', () => {
    setEngineSeed(42)
    const primera = Array.from({ length: 24 }, () => pickNodeForPhase(NODOS, 'LATERAL').id)
    setEngineSeed(42)
    const repetida = Array.from({ length: 24 }, () => pickNodeForPhase(NODOS, 'LATERAL').id)
    expect(primera).toEqual(repetida)
    expect(new Set(primera).size).toBeGreaterThan(1) // la secuencia no es degenerada
  })

  test('semillas distintas producen secuencias distintas', () => {
    setEngineSeed(1)
    const a = Array.from({ length: 24 }, () => pickNodeForPhase(NODOS, 'LATERAL').id)
    setEngineSeed(2)
    const b = Array.from({ length: 24 }, () => pickNodeForPhase(NODOS, 'LATERAL').id)
    expect(a).not.toEqual(b)
  })

  test('RECON y ARMADO solo eligen nodos de la DMZ', () => {
    setEngineSeed(9)
    const dmz = NODOS.filter((n) => n.segment === 'DMZ').map((n) => n.id)
    for (let i = 0; i < 20; i++) {
      expect(dmz).toContain(pickNodeForPhase(NODOS, 'RECON').id)
      expect(dmz).toContain(pickNodeForPhase(NODOS, 'ARMADO').id)
    }
  })

  test('OBJETIVO solo elige nodos de criticidad >= 4', () => {
    setEngineSeed(9)
    const valiosos = NODOS.filter((n) => n.criticality >= 4).map((n) => n.id)
    for (let i = 0; i < 20; i++) {
      expect(valiosos).toContain(pickNodeForPhase(NODOS, 'OBJETIVO').id)
    }
  })

  test('las demás fases eligen entre todos los nodos', () => {
    setEngineSeed(9)
    const todos = NODOS.map((n) => n.id)
    for (let i = 0; i < 20; i++) {
      expect(todos).toContain(pickNodeForPhase(NODOS, 'ESCALADA').id)
    }
  })

  test('sin semilla se restaura Math.random y la elección sigue siendo válida', () => {
    setEngineSeed(123)
    setEngineSeed() // restauración
    const todos = NODOS.map((n) => n.id)
    for (let i = 0; i < 20; i++) {
      expect(todos).toContain(pickNodeForPhase(NODOS, 'LATERAL').id)
    }
  })
})
