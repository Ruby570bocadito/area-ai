// ─────────────────────────────────────────────────────────────
// Fuerza del conocimiento institucional — fuente única
//
// La fórmula combina tres factores:
//   - confianza declarada de la lección (60 %)
//   - ratio de éxito real (timesWorked / timesUsed, 30 %;
//     0.5 neutro si aún no se ha usado)
//   - madurez por número de usos, saturada en 10 (10 %)
//
// Consumida por el motor (reinyección de memoria en campañas),
// por el agregado /api/state (orden del panel) y por el panel
// de conocimiento (UI). Función pura sin dependencias de
// servidor: utilizable en rutas API y componentes cliente.
// ─────────────────────────────────────────────────────────────

export interface KnowledgeScoreInput {
  confidence: number
  timesUsed: number
  timesWorked: number
}

export function knowledgeScore(k: KnowledgeScoreInput): number {
  const ratio = k.timesUsed > 0 ? k.timesWorked / k.timesUsed : 0.5
  return k.confidence * 0.6 + ratio * 0.3 + Math.min(1, k.timesUsed / 10) * 0.1
}
