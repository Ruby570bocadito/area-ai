// ─────────────────────────────────────────────────────────────
// Ritmo e intensidad de campaña — módulo puro.
//
// Concentra en una sola fuente los parámetros que deciden CUÁNTO
// ocurre en una campaña y con qué fuerza (cadencia de acciones,
// encadenamiento ofensivo, respuesta defensiva e impactos por
// acción). El motor (engine.ts) los consume; el contrato queda
// fijado en tests/pace.test.ts.
//
// Motivación: petición directa del usuario de campañas más
// LARGAS, INTENSAS y EXTENSAS. Al pasar de 8 a 12 rondas y de
// 2-4 a 3-6 acciones por ronda, los impactos por acción se
// recalibran a la baja para que el arco dramático (umbrales 70/45
// de victory.ts) se conserve sobre la escala cerrada [0, 100]:
// sin recalibración, el progreso saturaría antes del último
// tercio y el final perdería tensión. La ganancia fija de
// blindaje (+2) y el factor de criticidad del nodo NO se tocan:
// son contratos documentados de la telemetría (round-progression).
// Calibración en dos pasadas sobre campañas reales (20h15 y 20h2x):
// la primera dejaba BLUE parcheando a ciegas cada ronda y RED sin
// superficie explotable (22/100); con endurecimiento con criterio
// y estos impactos, los finales vuelven a la banda 45-90.
// ─────────────────────────────────────────────────────────────

import type { Phase } from './types'

// ── Cadencia ────────────────────────────────────────────────

/** Fases en las que RED puede encadenar una segunda acción (contacto ya establecido). */
export const CHAINABLE_PHASES: Phase[] = ['INTRUSION', 'ESCALADA', 'LATERAL', 'OBJETIVO']

/** Probabilidad de que RED encadene tras un ÉXITO real (antes 0.40). */
export const RED_CHAIN_ON_EXITO = 0.65

/** Probabilidad de que RED encadene tras un PARCIAL (momentum vivo pero incompleto; antes 0). */
export const RED_CHAIN_ON_PARCIAL = 0.35

/** Probabilidad de que el turno proactivo de BLUE sea threat hunting (el resto, parcheo/monitorización). */
export const BLUE_HUNT_ROLL = 0.3

// ── Impacto RED ─────────────────────────────────────────────

/** Impacto de progreso por gravedad declarada de la acción RED (antes 4/7/11/16). */
export const RED_IMPACT_BY_SEVERITY: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number> = {
  LOW: 4,
  MEDIUM: 5,
  HIGH: 8,
  CRITICAL: 12,
}

/** Factor aplicado al impacto base en un resultado PARCIAL. */
export const PARTIAL_IMPACT_FACTOR = 0.45

/** Gravedad por defecto por fase cuando el LLM no declara una válida. */
export const DEFAULT_SEVERITY_BY_PHASE: Record<Phase, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
  RECON: 'LOW',
  ARMADO: 'MEDIUM',
  INTRUSION: 'HIGH',
  ESCALADA: 'HIGH',
  LATERAL: 'HIGH',
  OBJETIVO: 'CRITICAL',
}

// ── Ganancia BLUE ───────────────────────────────────────────

/** Progreso defensivo por veredicto de la operación real (antes 10/8/6/5/1). */
export const BLUE_GAIN_BY_VERDICT: Record<string, number> = {
  BLOQUEADO: 5,
  CONTENIDO: 4,
  DETECTADO: 3,
  ENDURECIDO: 3,
  IGNORADO: 1,
}
