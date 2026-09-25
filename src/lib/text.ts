/**
 * Utilidades de texto compartidas por los paneles con búsqueda.
 *
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
