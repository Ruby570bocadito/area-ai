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

// ── Dificultad adaptativa ───────────────────────────────────
//
// Petición del ROADMAP (dificultad-adaptativa, [M]): ajustar la
// fuerza de la defensa según el historial de victorias del
// escenario, CON TOPE y DESACTIVABLE.
//
// Dos capas de balance que NO se solapan:
//   · Esta capa automática y GENTIL corrige por escenario con el
//     archivo vivo (banda estrecha ±15 %): si RED cierra casi todo
//     en un escenario concreto, la defensa de ese escenario se
//     refuerza; si BLUE lo contiene todo, se flexibiliza.
//   · La capa FORMAL es el veredicto de deriva (balance-drift.ts,
//     D30 ≥ 70 % del mismo ganador en 15+ archivadas): recalibra
//     pace.ts a mano cuando la deriva es persistente y global,
//     incluida la de empates — aquí los empates NO dan señal
//     direccional (un empate no dice a quién endurecer).
//
// El ajuste es CERO-SUMA: lo que gana BLUE lo pierde RED
// (impactoRedAjustado escala por 2−ajuste). La ganancia fija de
// blindaje (+2) NO se toca: contrato documentado de la telemetría
// (round-progression). Con ajuste = 1 el comportamiento es
// EXACTAMENTE el previo (identidad de las escalas, testada).
//
// El multiplicador se calcula UNA vez al lanzar (startCampaign)
// y se CONGELA en la fila de la campaña; el motor solo consume
// el valor guardado. En modo determinista queda neutro de serie:
// la reproducibilidad exacta de seed-determinista no admite
// parámetros que dependan del estado del archivo al lanzar.

/** Tope de refuerzo defensivo (RED dominante): defensa ×1.15 como máximo. */
export const DEF_AJUSTE_MAX = 1.15

/** Suelo de flexibilización (BLUE dominante): defensa ×0.85 como mínimo. */
export const DEF_AJUSTE_MIN = 0.85

/** Resueltas (RED+BLUE) mínimas del escenario para mover el ajuste: con menos, ruido. */
export const DEF_MUESTRA_MIN = 5

/** Tope de campañas archivadas consultadas por escenario (más recientes primero). */
export const DEF_HISTORIAL_TOPE = 50

/**
 * Pendiente de la respuesta lineal: de pRed 0.5 (equilibrio) a 0/1
 * el ajuste recorre la banda completa. Con 0.30, cada 10 puntos de
 * cuota RED mueven la defensa ±3 %: gentil por diseño.
 */
export const DEF_PENDIENTE = 0.3

/** Fila mínima del historial que alimenta el ajuste (desacoplado de Prisma). */
export interface FilaHistorialDefensa {
  winner: string | null // RED | BLUE | DRAW | null (solo COMPLETED)
}

/** Resultado del cálculo: el motor consume `ajuste`; el resto es evidencia auditable. */
export interface AjusteDefensa {
  /** Multiplicador de la fuerza defensiva en [DEF_AJUSTE_MIN, DEF_AJUSTE_MAX]. */
  ajuste: number
  /** false = neutra de pleno derecho (muestra insuficiente): no se congela ningún sesgo. */
  activa: boolean
  /** Cuota de victorias RED sobre las resueltas RED+BLUE (null sin resueltas). */
  cuotaRed: number | null
  /** Desglose del historial consultado. */
  red: number
  blue: number
  empates: number
}

/**
 * Normaliza un multiplicador entrante (de la fila congelada o de
 * una llamada directa): no finitos o no positivos degradan a neutro
 * y el valor válido se acota a la banda con tope. Fuente única de
 * la regla — el motor no aplica ajustes sin pasar por aquí.
 */
export function normalizarAjuste(ajuste: number): number {
  if (!Number.isFinite(ajuste) || ajuste <= 0) return 1
  return Math.min(DEF_AJUSTE_MAX, Math.max(DEF_AJUSTE_MIN, ajuste))
}

/**
 * Calcula el ajuste de fuerza defensiva para un escenario a partir
 * de su historial archivado (filas { winner } de campañas COMPLETED,
 * ya acotadas a las DEF_HISTORIAL_TOPE más recientes por el llamador).
 * Puro y determinista: mismas filas → mismo ajuste.
 */
export function ajusteDefensivo(historial: FilaHistorialDefensa[]): AjusteDefensa {
  let red = 0
  let blue = 0
  let empates = 0
  for (const fila of historial ?? []) {
    if (fila.winner === 'RED') red += 1
    else if (fila.winner === 'BLUE') blue += 1
    else empates += 1
  }

  const resueltas = red + blue
  if (resueltas < DEF_MUESTRA_MIN) {
    return { ajuste: 1, activa: false, cuotaRed: resueltas > 0 ? red / resueltas : null, red, blue, empates }
  }

  const cuotaRed = red / resueltas
  const bruto = 1 + (cuotaRed - 0.5) * DEF_PENDIENTE
  const ajuste = Math.round(normalizarAjuste(bruto) * 1000) / 1000
  return { ajuste, activa: true, cuotaRed, red, blue, empates }
}

/**
 * Impacto RED ajustado por la fuerza defensiva congelada (cero-suma:
 * defensa ×1.15 ⇒ ofensiva ×0.85). Con ajuste neutro devuelve EXACTAMENTE
 * Math.round(base) — identidad de comportamiento previo, testada.
 */
export function impactoRedAjustado(base: number, ajuste: number): number {
  return Math.round(base * (2 - normalizarAjuste(ajuste)))
}

/**
 * Ganancia BLUE ajustada por la fuerza defensiva congelada. Con ajuste
 * neutro devuelve EXACTAMENTE Math.round(ganancia de tabla) — identidad
 * de comportamiento previo, testada. El veredicto desconocido degrada a
 * IGNORADO (misma regla que el motor ya aplicaba con `?? 1`).
 */
export function gananciaAzulAjustada(verdict: string, ajuste: number): number {
  return Math.round((BLUE_GAIN_BY_VERDICT[verdict] ?? 1) * normalizarAjuste(ajuste))
}

// ── Prioridad de parcheo ────────────────────────────────────

/**
 * Bonus de prioridad de un nodo COMPROMETIDO sobre su criticidad al
 * elegir el objetivo del parche (bestPatchTarget, antes «+10»
 * hardcodeado): calibrado para que un nodo tocado de criticidad 3
 * (3+10=13) gane a uno limpio de criticidad 5 pero pierda contra la
 * conjunción «comprometido Y muy crítico». Es una regla TÁCTICA de
 * selección de objetivo — NO escala con el ajuste adaptativo (que
 * modula la fuerza, no la elección), y su contrato está fijado en
 * tests/engine.test.ts («un nodo comprometido prioriza…»).
 */
export const PATCH_BONUS_COMPROMETIDO = 10

// ── Autotuning de balance (autotuning-balance) ─────────────

/**
 * Banda objetivo de la tasa de victoria de RED (el atacante) en el
 * autotuning: por debajo de 0.4 la defensa domina, por encima de 0.6
 * el ataque — fuera de banda abre la pregunta de recalibración formal
 * de pace.ts (decisión de DIR, igual que el veredicto de
 * balance-drift: este bloque MIDE, no recalibra).
 */
export const AUTOTUNING_TASA_MIN = 0.4
export const AUTOTUNING_TASA_MAX = 0.6

/**
 * Muestra mínima por escenario para emitir un veredicto EN BANDA o
 * FUERA de banda. Con menos, el informe es MUESTRA_CORTA: la tasa se
 * publica igualmente (información, no veredicto) — con 2 campañas,
 * cada resultado mueve la tasa 50 puntos y el «veredicto» sería ruido.
 */
export const AUTOTUNING_MUESTRA_MIN = 5

export interface AutotuningCifras {
  /** Campañas COMPLETED del escenario (la muestra real). */
  total: number
  /** Victorias de RED. */
  red: number
  /** Victorias de BLUE. */
  blue: number
  /** Empates (ni RED ni BLUE — señal de H-003, se expone siempre). */
  empate: number
}

export type AutotuningEstado =
  | 'SIN_DATOS' // 0 finalizadas
  | 'MUESTRA_CORTA' // finalizadas < muestraMin — tasa informativa
  | 'EQUILIBRIO' // tasaRed en [MIN, MAX]
  | 'TASA_BAJA' // RED < MIN — la defensa domina
  | 'TASA_ALTA' // RED > MAX — el ataque domina

export interface AutotuningVeredicto {
  finalizadas: number
  /** Victorias RED / finalizadas (null sin muestra). */
  tasaRed: number | null
  /** Empates / finalizadas (H-003: todas empate = tasaEmpate 1). */
  tasaEmpate: number
  /** null solo con SIN_DATOS. */
  enBanda: boolean | null
  estado: AutotuningEstado
}

/**
 * Veredicto de la tasa de victoria RED de una muestra de campañas
 * (un escenario o el conjunto agrupado). Puro y sin reloj: las cifras
 * llegan contadas — el script las levanta de las filas COMPLETED.
 *
 * Contrato fijado en tests/autotuning-balance.test.ts: los empates
 * cuentan en el denominador (son campañas reales del sample — ocultar
 * los empates inflaría la tasa y escondería la señal de H-003) y la
 * banda es INCLUSIVA en los extremos [0.4, 0.6] (40 % y 60 % exactos
 * son EQUILIBRIO: el objetivo orientativo del ROADMAP incluye el borde).
 */
export function veredictoAutotuning(
  cifras: AutotuningCifras,
  opciones?: { muestraMin?: number },
): AutotuningVeredicto {
  const muestraMin = opciones?.muestraMin ?? AUTOTUNING_MUESTRA_MIN
  const { total, red, empate } = cifras
  if (total <= 0) {
    return { finalizadas: 0, tasaRed: null, tasaEmpate: 0, enBanda: null, estado: 'SIN_DATOS' }
  }
  const tasaRed = red / total
  const tasaEmpate = empate / total
  const enBanda = tasaRed >= AUTOTUNING_TASA_MIN && tasaRed <= AUTOTUNING_TASA_MAX
  const estado: AutotuningEstado =
    total < muestraMin
      ? 'MUESTRA_CORTA'
      : enBanda
        ? 'EQUILIBRIO'
        : tasaRed < AUTOTUNING_TASA_MIN
          ? 'TASA_BAJA'
          : 'TASA_ALTA'
  return { finalizadas: total, tasaRed, tasaEmpate, enBanda, estado }
}
