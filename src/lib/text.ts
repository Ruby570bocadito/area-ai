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

/**
 * Fecha y hora legible (locale es-ES) — fuente única para los informes
 * Markdown de campaña (el agregado del archivo y el informe en vivo):
 *
 *   · fecha válida     → "25/9/25 19:03" (formato del locale es-ES)
 *   · nula o inválida  → "—"
 *
 * Delegar el formateo en una sola función garantiza que ambos informes
 * muestren las marcas temporales con el mismo formato y que la ausencia
 * de fecha se degrade con el mismo guion largo que las duraciones.
 */
export function formatDateTime(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-ES')
}

/**
 * Celda CSV segura — fuente única del dialecto CSV de la app
 * (exportadores de campañas en history-panel.tsx, de conocimiento en
 * knowledge-export.ts y de telemetría anunciado para la ficha).
 *
 * Dos mecanismos, en este orden:
 *
 *   1. Neutralización de fórmulas (hardening HD2, Ronda 16 de bugs —
 *      hallazgo HD2 de la Ronda 14; técnica OWASP «CSV Injection»):
 *      una celda que EMPIEZA por `=`, `+`, `-` o `@` (o tab/CR, que
 *      permiten smuggle de prefijo) se interpreta como fórmula al abrir
 *      el fichero en Excel/LibreOffice/Sheets — p. ej.
 *      `=HYPERLINK("http://evil","clic")` filtra interacciones sin
 *      confirmación previa. Se prefija un apóstrofe visible mínimo para
 *      que la hoja la trate como texto. El contenido de las celdas es
 *      semilibre (títulos, contenido y tags generados por el LLM), de
 *      modo que la neutralización vive en la fuente única y cubre todos
 *      los exportadores sin que ninguno la repita. Se comprueba el
 *      PRIMER carácter tal cual (sin recortar): una celda con espacio
 *      inicial ya es texto inerte para la hoja, y recortar alteraría el
 *      dato. Nota de alcance: las celdas numéricas negativas legítimas
 *      también se prefijan — ningún dato actual de los exportadores es
 *      negativo (recuentos ≥ 0, progreso acotado [0,100] por el clamp
 *      del motor); si un exportador futuro necesita negativos, será
 *      decisión explícita suya relajar el prefijo para `-N`.
 *
 *   2. Escapado RFC 4180: si la celda contiene el separador («;»),
 *      comillas o salto de línea, se envuelve entre comillas dobles
 *      duplicando las comillas internas. Así los títulos con «;»,
 *      comillas o saltos no rompen la columna ni la fila.
 */
export function csvEscapeCell(v: string | number): string {
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Nombre de fichero de exportación — fuente única de la marca temporal
 * para los TRES exportadores de la app (campañas e informe agregado en
 * history-panel.tsx, conocimiento en knowledge-panel.tsx y telemetría
 * de eventos en la ficha /historial/[id]):
 *
 *   exportFilename('campanas', 'csv') → "area-ai-campanas-20260925-2107.csv"
 *
 * Antes de centralizarse, el patrón pad+timestamp vivía replicado en
 * dos componentes (y la ficha lo habría replicado una tercera vez);
 * dedupe de la ronda implementaciones-13 (backlog #5 de la ronda
 * anterior). El prefijo va en kebab-case y sin espacios — el llamante
 * decide el término identificador («campanas», «informe»,
 * «conocimiento», «telemetria-<codename>»…).
 */
export function exportFilename(prefix: string, ext: 'csv' | 'json' | 'md'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `area-ai-${prefix}-${stamp}.${ext}`
}
