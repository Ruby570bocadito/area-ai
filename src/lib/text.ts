/**
 * Utilidades de texto y formato compartidas por toda la app.
 *
 * Módulo puro (sin React ni DOM), patrón victory.ts/knowledge-score.ts:
 * utilizable en rutas API, componentes cliente y tests unitarios.
 */

/**
 * Búsqueda tolerante a acentos/mayúsculas: "exfiltracion" encuentra
 * "exfiltración" y "abaco" encuentra "ÁBACO". Se normaliza el término
 * y el texto con la misma función, así que basta con compararlos.
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Duración legible a partir de milisegundos — fuente única para toda
 * la app (informe agregado, ficha de detalle y futuros consumos):
 *
 *   · menos de 1 min → "45s"
 *   · menos de 1 h   → "10m 05s" (segundos siempre a 2 dígitos)
 *   · 1 h o más      → "1h 05m"
 *   · inválida (NaN, ≤ 0) → "—"
 *
 * El formato exacto queda fijado por tests (tests/text.test.ts y el
 * contrato de formato de tests/aggregate-report.test.ts) para que la
 * ficha y el informe agregado muestren siempre la misma duración.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}
