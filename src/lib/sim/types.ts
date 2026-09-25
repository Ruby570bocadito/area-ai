// ─────────────────────────────────────────────────────────────
// AEGIS ARENA — Tipos compartidos del motor de simulación
// ─────────────────────────────────────────────────────────────

export type Team = 'RED' | 'BLUE'

export type Phase =
  | 'RECON'
  | 'ARMADO'
  | 'INTRUSION'
  | 'ESCALADA'
  | 'LATERAL'
  | 'OBJETIVO'

export const PHASE_LABEL: Record<Phase, string> = {
  RECON: 'Reconocimiento',
  ARMADO: 'Armado y Preparación',
  INTRUSION: 'Intrusión Inicial',
  ESCALADA: 'Escalada de Privilegios',
  LATERAL: 'Movimiento Lateral',
  OBJETIVO: 'Objetivo / Exfiltración',
}

// Campañas LARGAS: 2 rondas por cada una de las 6 fases → 12 rondas
// (petición directa del usuario: rondas más largas, intensas y extensas).
// El motor deriva maxRounds de esta lista y la fase de cada ronda con
// PHASE_ORDER[round - 1]; el roster rota especialistas dentro de cada fase
// (pickAgentForPhase) para que las dos rondas de una fase no repitan agente.
// maxRounds se archiva en BD por campaña: las fichas históricas (8 rondas)
// siguen siendo consistentes con sus propios eventos.
export const PHASE_ORDER: Phase[] = [
  'RECON',
  'RECON',
  'ARMADO',
  'ARMADO',
  'INTRUSION',
  'INTRUSION',
  'ESCALADA',
  'ESCALADA',
  'LATERAL',
  'LATERAL',
  'OBJETIVO',
  'OBJETIVO',
]

export interface InfraNode {
  id: string
  name: string
  type: string // WEB | APP | DB | AD | ENDPOINT | SIEM | OT | VPN | BACKUP | API | CDN
  ip: string
  segment: string // INTERNET | DMZ | CORE | AD | OT | CLOUD
  criticality: number // 1-5
  vulnerabilities: string[]
  controls: string[]
}

export interface Infrastructure {
  nodes: InfraNode[]
}

export interface RedDecision {
  action: string
  detail: string
  targetNode: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface BlueDecision {
  action: string
  detail: string
  verdict: 'BLOQUEADO' | 'DETECTADO' | 'CONTENIDO' | 'IGNORADO'
}

export interface AgentDef {
  key: string
  codename: string
  team: Team
  role: string
  specialty: string
  icon: string
  description: string
  /** fases en las que este agente toma la iniciativa */
  phases: Phase[]
}

export interface ScenarioDef {
  key: string
  codename: string
  company: string
  industry: string
  difficulty: number
  description: string
  infrastructure: Infrastructure
  redObjective: string
  blueObjective: string
}

export interface KnowledgeRef {
  id: string
  team: string
  category: string
  title: string
  content: string
  tags: string
  confidence: number
  timesUsed: number
  timesWorked: number
}

export interface EventDraft {
  round: number
  phase: string
  team: Team | 'SYSTEM'
  agentKey?: string
  agentCodename?: string
  action: string
  detail: string
  result?: string
  impact?: number
  severity?: string
  targetNode?: string
}

export interface LessonDraft {
  category: string
  title: string
  content: string
  tags: string[]
  confidence: number
}
