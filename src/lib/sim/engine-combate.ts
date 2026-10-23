// ─────────────────────────────────────────────────────────────
// engine-combate — modelo de combate: momentum RED, escalas de
// impacto, mapeos fase→firma/segmento/hipótesis, selección del
// mejor parche y fallbacks deterministas (modo SIM).
//
// Extraído de engine.ts (refactor-engine-fases) sin cambiar
// comportamiento. La frontera natural del módulo la marcan
// `redShouldChain` y `accumulateProgress` (ya extraídos y
// testados como red de seguridad en tests/engine.test.ts,
// tarea tests-engine previa a esta refactorización).
// ─────────────────────────────────────────────────────────────

import { PATCH_BONUS_COMPROMETIDO, RED_CHAIN_ON_EXITO, RED_CHAIN_ON_PARCIAL } from './pace'
import type { Phase, RedDecision, InfraNode } from './types'
import type { OpOutcome } from '@/lib/lab/ops'
import type { LabCampaignState, Signature } from '@/lib/lab/types'
import { clampProgress } from '@/lib/victory'
import { pickNodeForPhase } from './engine-select'

// ── Utilidades compartidas del modelo de combate ───────────

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Acumulación de progreso en la escala cerrada [0, 100] (fuente única de la regla: victory.ts). */
export function accumulateProgress(current: number, delta: number): number {
  return clampProgress(current + delta)
}

/**
 * Momentum RED: ¿encadena una segunda acción dentro de la fase?
 * ÉXITO encadena alto, PARCIAL moderado y FALLO nunca (constantes
 * en pace.ts). `roll` es la tirada [0, 1): con el RNG sembrado la
 * decisión es reproducible ronda a ronda.
 */
export function redShouldChain(result: string | undefined, roll: number): boolean {
  const chainP = result === 'EXITO' ? RED_CHAIN_ON_EXITO : result === 'PARCIAL' ? RED_CHAIN_ON_PARCIAL : 0
  return chainP > 0 && roll < chainP
}

// ── Mapeos de fase sobre el estado real del laboratorio ────

export function defaultSignatureFor(phase: Phase): Signature {
  switch (phase) {
    case 'RECON': return 'PORT_SCAN'
    case 'ARMADO': return 'UNUSUAL_PATH'
    case 'INTRUSION': return 'SQLI'
    case 'ESCALADA': return 'PASS_THE_HASH'
    case 'LATERAL': return 'LATERAL_SMB'
    case 'OBJETIVO': return 'DATA_EXFIL'
  }
}

export function segmentForPhase(phase: Phase): string {
  switch (phase) {
    case 'RECON': return 'DMZ'
    case 'ARMADO': return 'DMZ'
    case 'INTRUSION': return 'DMZ'
    case 'ESCALADA': return 'CORE'
    case 'LATERAL': return 'CORE'
    case 'OBJETIVO': return 'CORE'
  }
}

export function huntHypothesis(phase: Phase): string {
  switch (phase) {
    case 'RECON': return 'enumeración temprana de superficie'
    case 'ARMADO': return 'preparación de payload en endpoints'
    case 'INTRUSION': return 'acceso inicial anómalo en la DMZ'
    case 'ESCALADA': return 'abuso de credenciales privilegiadas'
    case 'LATERAL': return 'pivoting entre segmentos'
    case 'OBJETIVO': return 'exfiltración masiva de datos'
  }
}

/**
 * Busca el mejor parche real: nodo comprometido o de mayor criticidad
 * con vuln abierta. La prioridad del nodo comprometido es el bonus
 * táctico PATCH_BONUS_COMPROMETIDO (pace.ts, antes +10 hardcodeado):
 * regla de ELECCIÓN de objetivo — no escala con el ajuste adaptativo
 * de la fuerza defensiva (dificultad-adaptativa).
 */
export function bestPatchTarget(lab: LabCampaignState, preferNodeId?: string): { nodeId?: string; vuln?: string } {
  const candidates: Array<{ nodeId: string; vuln: string; crit: number }> = []
  for (const n of lab.nodes.values()) {
    for (const [vuln, st] of Object.entries(n.vulnerabilities)) {
      if (st === 'OPEN') candidates.push({ nodeId: n.nodeId, vuln, crit: n.criticality + (n.compromised ? PATCH_BONUS_COMPROMETIDO : 0) })
    }
  }
  if (preferNodeId) {
    const preferred = candidates.filter((c) => c.nodeId === preferNodeId).sort((a, b) => b.crit - a.crit)[0]
    if (preferred) return { nodeId: preferred.nodeId, vuln: preferred.vuln }
  }
  const best = candidates.sort((a, b) => b.crit - a.crit)[0]
  return best ? { nodeId: best.nodeId, vuln: best.vuln } : {}
}

// ── Fallbacks deterministas (modo SIM) — siempre en español ─

export function fallbackBlueName(op: string, verdict: string): string {
  const names: Record<string, string> = {
    BLOCK: 'Bloqueo de sesión atacante',
    ISOLATE: 'Aislamiento del host comprometido',
    PATCH: 'Parcheo de vulnerabilidad explotada',
    MONITOR: 'Despliegue de regla de monitorización',
    HUNT: 'Threat hunting proactivo',
  }
  return names[op] ?? (verdict === 'IGNORADO' ? 'Barrido sin señales' : 'Acción defensiva')
}

export function fallbackBlueDetail(op: string, outcome: OpOutcome, verdict: string): string {
  const ev = outcome.evidence.exchanges[0]
  const base: Record<string, string> = {
    BLOCK: 'Regla de firewall aplicada en el laboratorio: la sesión atacante queda denegada para futuras conexiones.',
    ISOLATE: 'El EDR aisló el host: sus sesiones se revocaron y el nodo deja de responder a la red.',
    PATCH: 'Parche aplicado sobre la vulnerabilidad real del nodo; los siguientes intentos de explotación fallarán.',
    MONITOR: 'Regla de correlación desplegada en el SIEM sobre el tráfico real del segmento.',
    HUNT: 'Barrido forense sobre el diario real de tráfico del laboratorio.',
  }
  return `${base[op] ?? 'Operación defensiva ejecutada.'} ${ev ? `Verificación: ${ev.method} ${ev.path} → ${ev.status}.` : ''} Veredicto: ${verdict}.`
}

const RED_FALLBACK: Record<Phase, Array<{ action: string; detail: string; severity: RedDecision['severity'] }>> = {
  RECON: [
    { action: 'Enumeración de servicios expuestos', detail: 'Fingerprinting real de los servicios del nodo objetivo mediante peticiones HTTP directas al laboratorio.', severity: 'LOW' },
    { action: 'Cartografía de la DMZ', detail: 'Consulta rutas públicas y ficheros de configuración expuestos para mapear el perímetro.', severity: 'LOW' },
  ],
  ARMADO: [
    { action: 'Weaponización de exploit', detail: 'Genera un payload determinista y calcula su hash real para la cadena de intrusión.', severity: 'MEDIUM' },
    { action: 'Preparación de infraestructura C2', detail: 'Configura el canal de mando y control para la fase de intrusión.', severity: 'MEDIUM' },
  ],
  INTRUSION: [
    { action: 'Explotación del perímetro', detail: 'Ejecuta el exploit real contra la vulnerabilidad abierta del servicio expuesto.', severity: 'HIGH' },
    { action: 'Phishing dirigido con payload', detail: 'Entrega el payload contra el endpoint objetivo y verifica la ejecución real.', severity: 'HIGH' },
  ],
  ESCALADA: [
    { action: 'Escalada de privilegios local', detail: 'Abusa de la vulnerabilidad local sin parchear del host comprometido para obtener SYSTEM.', severity: 'HIGH' },
    { action: 'Robo y abuso de credenciales', detail: 'Eleva privilegios reutilizando la sesión establecida en el host.', severity: 'CRITICAL' },
  ],
  LATERAL: [
    { action: 'Movimiento lateral por SMB/WMI', detail: 'Pivota hacia el nodo objetivo reutilizando la sesión comprometida (ruta verificada por el laboratorio).', severity: 'HIGH' },
    { action: 'Pivoting sobre jump host', detail: 'Salta al siguiente segmento desde la sesión existente y establece nuevo acceso.', severity: 'CRITICAL' },
  ],
  OBJETIVO: [
    { action: 'Exfiltración de datos críticos', detail: 'Solicita los datos del activo crítico con la sesión privilegiada y verifica la respuesta real.', severity: 'CRITICAL' },
    { action: 'Acceso al activo de misión', detail: 'Extrae la telemetría/documentación sensible del activo objetivo.', severity: 'CRITICAL' },
  ],
}

export function fallbackRed(phase: Phase, nodes: InfraNode[], round: number): RedDecision {
  const t = RED_FALLBACK[phase][round % 2]
  const node = pickNodeForPhase(nodes, phase)
  return { action: t.action, detail: t.detail, targetNode: node.id, severity: t.severity }
}
