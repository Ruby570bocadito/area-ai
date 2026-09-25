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
