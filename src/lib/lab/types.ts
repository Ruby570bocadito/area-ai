// ─────────────────────────────────────────────────────────────
// LAB REAL — Tipos compartidos del ciber range interno.
//
// El laboratorio levanta servicios HTTP REALES (servidor Node
// en 127.0.0.1) que modelan la infraestructura del escenario.
// Los agentes no tiran dados: ejecutan intercambios HTTP
// verificables contra esos servicios y el resultado se deriva
// de las respuestas reales (códigos de estado, sesiones,
// datos servidos). La detección se hace correlacionando el
// diario de tráfico REAL del laboratorio.
// ─────────────────────────────────────────────────────────────

/** Firmas de comportamiento que el runtime clasifica en cada petición real */
export type Signature =
  | 'PORT_SCAN'
  | 'SQLI'
  | 'PATH_TRAVERSAL'
  | 'BOLA_ENUM'
  | 'BRUTE_FORCE'
  | 'UNUSUAL_PATH'
  | 'PASS_THE_HASH'
  | 'LATERAL_SMB'
  | 'DATA_EXFIL'
  | 'RCE_PAYLOAD'

export const SIGNATURE_LABEL: Record<Signature, string> = {
  PORT_SCAN: 'Escaneo de puertos/servicios',
  SQLI: 'Inyección SQL',
  PATH_TRAVERSAL: 'Path traversal',
  BOLA_ENUM: 'Enumeración BOLA/IDOR',
  BRUTE_FORCE: 'Fuerza bruta de credenciales',
  UNUSUAL_PATH: 'Ruta inusual',
  PASS_THE_HASH: 'Pass-the-hash',
  LATERAL_SMB: 'Movimiento lateral SMB/WMI',
  DATA_EXFIL: 'Exfiltración de datos',
  RCE_PAYLOAD: 'Payload de ejecución remota',
}

/** Reglas de monitorización desplegadas por BLUE en el SIEM */
export interface LabMonitorRule {
  id: string
  segment: string
  nodeId?: string
  signature: Signature
  deployedRound: number
  by: string
}

export interface LabFirewallRule {
  id: string
  blockSessionId?: string
  blockNodeId?: string
  reason: string
  deployedRound: number
  by: string
}

/** Un intercambio HTTP real dentro del laboratorio */
export interface LabExchange {
  id: number
  at: string
  round: number
  nodeId: string
  method: string
  path: string
  status: number
  ms: number
  sessionId?: string
  team: 'RED' | 'BLUE' | 'SYSTEM'
  signature?: Signature
  reqSnippet?: string
  resSnippet?: string
  bytes: number
}

/** Estado de un nodo del laboratorio durante la campaña */
export interface LabNodeState {
  nodeId: string
  segment: string
  type: string
  criticality: number
  vulnerabilities: Record<string, 'OPEN' | 'PATCHED'> // nombre vuln → estado
  controls: string[]
  compromised: boolean // hay sesión activa de RED
  isolated: boolean // aislado por BLUE
  patchesApplied: string[]
}

export interface LabSession {
  id: string
  homeNodeId: string
  team: 'RED' | 'BLUE'
  agentKey?: string
  privileges: 'USER' | 'ADMIN' | 'SYSTEM'
  createdRound: number
  createdAt: string
  revoked: boolean
  origin: string // 'exploit-sqli' | 'exploit-rce' | 'phish' | 'vpn' | 'lateral' | 'escalation'
}

export interface LabCampaignState {
  campaignId: string
  scenarioKey: string
  company: string
  bootedAt: string
  round: number
  nodes: Map<string, LabNodeState>
  sessions: Map<string, LabSession>
  journal: LabExchange[]
  monitors: LabMonitorRule[]
  firewall: LabFirewallRule[]
  exfiltrated: Array<{ table: string; bytes: number; at: string }>
  seq: number
}

/** Nivel de red por segmento: define qué es alcanzable desde dónde */
export const SEGMENT_LEVEL: Record<string, number> = {
  INTERNET: 0,
  DMZ: 1,
  CORE: 2,
  AD: 2,
  CLOUD: 2,
  OT: 3,
}

/** Evidencia serializada en el campo evidence de CampaignEvent */
export interface EventEvidence {
  exchanges: Array<{
    method: string
    path: string
    status: number
    ms: number
    res?: string
  }>
  artifacts: string[]
  detections?: string[]
}

export function serializeEvidence(ev: EventEvidence): string {
  return JSON.stringify(ev)
}

/** Resumen corto de una respuesta para evidencia (máx 120 chars, sin saltos) */
export function snippet(s: string, max = 120): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean
}
