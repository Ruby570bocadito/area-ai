// ─────────────────────────────────────────────────────────────
// Taxonomía de lecciones archivadas (Ronda 8, Implementaciones).
//
// El esquema documenta Knowledge.category como un enum de facto
// (prisma/schema.prisma: TACTICA | TECNICA | DEFENSA | VULNERABILIDAD |
// LECCION | INTELIGENCIA), pero hasta esta ronda el motor archivaba la
// categoría que devolviera el LLM sin whitelist (engine.ts solo pedía 4
// de las 6 categorías válidas en el prompt y guardaba la salida tal cual).
// Una categoría fuera de taxonomía se propaga en silencio a /conocimiento,
// /api/knowledge y a los prompts de campañas siguientes.
//
// Módulo puro (patrón text.ts / victory.ts / round-progression.ts): sin
// React, sin DOM, sin DB — testeable de forma unitaria y consumible desde
// el motor y desde cualquier script.
// ─────────────────────────────────────────────────────────────

/** Categorías válidas según el esquema (enum de facto de Knowledge.category). */
export const KNOWLEDGE_CATEGORIES = [
  'TACTICA',
  'TECNICA',
  'DEFENSA',
  'VULNERABILIDAD',
  'LECCION',
  'INTELIGENCIA',
] as const

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

/** Categoría por defecto cuando la entrada no es reconocible. */
export const DEFAULT_CATEGORY: KnowledgeCategory = 'LECCION'

/**
 * Normaliza la categoría de una lección a la taxonomía del esquema.
 * Acepta mayúsculas/minúsculas y espacios sobrantes; cualquier valor
 * no reconocido (incluidos null/undefined/no-string) degrada a LECCION.
 */
export function normalizeLessonCategory(raw: unknown): KnowledgeCategory {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value)
    ? (value as KnowledgeCategory)
    : DEFAULT_CATEGORY
}

/** Límite de longitud del campo tags en la BD (schema.prisma). */
const TAGS_MAX_LENGTH = 200

/**
 * Normaliza los tags de una lección a la representación canónica del
 * almacenamiento: cadena separada por comas, tokens recortados, en
 * minúsculas, sin duplicados y sin tokens vacíos ("a,,b" → "a,b").
 * Acepta array de tags (formato del prompt LLM) o cadena ya separada
 * por comas (formato de la BD). Sin tokens útiles degrada a 'general'
 * — el matching por fase del motor (PHASE_TAGS) espera al menos uno.
 */
export function normalizeLessonTags(raw: unknown): string {
  const parts =
    Array.isArray(raw)
      ? raw.map((t) => String(t).trim().toLowerCase())
      : typeof raw === 'string'
        ? raw.split(',').map((t) => t.trim().toLowerCase())
        : []
  const unique = [...new Set(parts.filter(Boolean))]
  const joined = unique.join(',')
  return joined.length > 0 ? joined.slice(0, TAGS_MAX_LENGTH) : 'general'
}
