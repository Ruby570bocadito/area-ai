// ─────────────────────────────────────────────────────────────
// Regla de victoria del motor — fuente única para UI.
//
// El ganador de una campaña NO lo decide la puntuación (los
// puntos son métrica de actividad), sino el PROGRESO de los
// objetivos (ver src/lib/sim/engine.ts, resolución final):
//
//   · RED gana  → progreso RED ≥ 70/100 y además supera al progreso BLUE
//   · BLUE gana → progreso RED se queda por debajo de 45/100
//   · Empate    → cualquier otro caso final
//
// Esta traducción a lenguaje natural se usa en la fila del
// historial, el badge de resultado, el banner de resolución y
// el toast de fin de campaña, para que el marcador no confunda.
// ─────────────────────────────────────────────────────────────

export const VICTORY_RULE_SHORT = 'Gana por progreso, no por puntos'
export const VICTORY_RULE_DETAIL =
  'RED gana si alcanza ≥70 de progreso y supera la postura BLUE. ' +
  'BLUE gana si RED se queda por debajo de 45. En cualquier otro caso, empate táctico.'

// ─────────────────────────────────────────────────────────────
// Resolución canónica del desenlace (fuente única para motor y UI)
//
// El progreso de objetivos es una escala CERRADA [0, 100]: los
// updates intermedios del motor ya acotan, y desde la Ronda 9 de
// bugs la acumulación RED y la escritura final también (el exceso
// archivado como "114/100" era un artefacto de desbordamiento, no
// métrica). La regla de victoria se aplica SIEMPRE sobre el
// progreso acotado: si ambos equipos saturan la escala, el
// desenlace es empate a 100/100 — nunca gana el mayor
// desbordamiento.
// ─────────────────────────────────────────────────────────────

/** Límite inferior de la escala de progreso de objetivos. */
export const PROGRESS_MIN = 0
/** Límite superior de la escala de progreso de objetivos. */
export const PROGRESS_MAX = 100

/** Acota un valor de progreso a la escala cerrada [0, 100]; no finitos degradan a 0. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return PROGRESS_MIN
  return Math.min(PROGRESS_MAX, Math.max(PROGRESS_MIN, value))
}

export type CampaignOutcome = {
  winner: 'RED' | 'BLUE' | 'DRAW'
  redProgress: number
  blueProgress: number
}

/**
 * Regla de victoria del motor aplicada sobre el progreso ACOTADO.
 * Fuente única del cómputo (engine.ts la consume en la resolución
 * final; la UI ya compartía este módulo para la explicación).
 */
export function resolveCampaignOutcome(redProgress: number, blueProgress: number): CampaignOutcome {
  const red = clampProgress(redProgress)
  const blue = clampProgress(blueProgress)
  const winner: CampaignOutcome['winner'] =
    red >= 70 && red > blue ? 'RED' : red < 45 ? 'BLUE' : 'DRAW'
  return { winner, redProgress: red, blueProgress: blue }
}

export type VictoryReason = string

/** Frase que explica POR QUÉ se ganó, según la regla del motor. */
export function explainWinner(
  winner: string | null | undefined,
  redProgress: number,
  blueProgress: number
): VictoryReason {
  const red = Math.round(redProgress)
  const blue = Math.round(blueProgress)

  if (winner === 'RED') {
    if (red > blue && red >= 70) {
      return `RED alcanzó ${red}/100 de progreso (umbral 70) y superó la postura azul (${blue}/100).`
    }
    // No debería ocurrir con la regla actual, pero evita frases imposibles
    return `Victoria RED con progreso ${red}/100 frente a ${blue}/100.`
  }

  if (winner === 'BLUE') {
    if (red < 45) {
      return `El objetivo ofensivo quedó frustrado: RED se quedó en ${red}/100, por debajo del umbral de 45.`
    }
    return `Victoria BLUE con progreso RED ${red}/100 frente a ${blue}/100.`
  }

  if (red >= 70) {
    return `RED llegó a ${red}/100 pero no superó la postura azul (${blue}/100): sin resolución.`
  }
  if (red >= 45) {
    return `RED avanzó ${red}/100 sin alcanzar el umbral de 70: empate táctico.`
  }
  return `Sin resolución: RED ${red}/100 y BLUE ${blue}/100.`
}

/** Etiqueta compacta del motivo para caber en una fila (p. ej. "RED 78/100 decisivo"). */
export function decisiveProgressLabel(winner: string | null | undefined, redProgress: number, blueProgress: number): string {
  const red = Math.round(redProgress)
  const blue = Math.round(blueProgress)
  if (winner === 'RED') return `progreso ${red}/100`
  if (winner === 'BLUE') return `contenida en ${red}/100`
  return `${red}/100 vs ${blue}/100`
}
