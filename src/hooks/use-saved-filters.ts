'use client'

import { useSyncExternalStore } from 'react'

// ─────────────────────────────────────────────────────────────
// filtros-guardados: tienda local de combinaciones de filtros
// del historial, persistidas en localStorage del navegador.
//
// Diseño:
// - Los helpers PUROS (sanitizar, parsear, upsert, sugerir
//   nombre) se exportan para tests unitarios — el contrato de
//   validación vive aquí y es único.
// - La suscripción usa useSyncExternalStore con getServerSnapshot
//   vacío: durante la hidratación React lee el snapshot del
//   servidor y re-lee el real después, sin mismatch ni
//   setState-en-efecto (mismo patrón de estado derivado que el
//   resto del panel).
// - El listener `storage` sincroniza pestañas sin coste extra.
// ─────────────────────────────────────────────────────────────

export const SAVED_FILTERS_KEY = 'area-ai.saved-filters.v1'
export const SAVED_FILTERS_MAX = 8
export const SAVED_FILTERS_NAME_MAX = 40
export const SAVED_FILTERS_QUERY_MAX = 120
export const SAVED_FILTERS_SCENARIO_MAX = 80

const VALID_RESULTS = ['ALL', 'RED', 'BLUE', 'DRAW', 'RUNNING'] as const

export type SavedFilterResult = (typeof VALID_RESULTS)[number]

export type SavedFilter = {
  id: string
  name: string
  result: SavedFilterResult
  scenario: string
  query: string
  savedAt: string
}

// ── Helpers puros ──

/** Recorta y limpia un nombre de preset (tope SAVED_FILTERS_NAME_MAX). */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, SAVED_FILTERS_NAME_MAX)
}

/** Recorta la búsqueda al mismo tope que el deep-link ?q= (120). */
export function sanitizeQuery(raw: string): string {
  return raw.trim().slice(0, SAVED_FILTERS_QUERY_MAX)
}

/** Dos presets son la misma combinación si coinciden sus tres filtros. */
export function sameCombination(
  a: Pick<SavedFilter, 'result' | 'scenario' | 'query'>,
  b: Pick<SavedFilter, 'result' | 'scenario' | 'query'>
): boolean {
  return a.result === b.result && a.scenario === b.scenario && a.query === b.query
}

/** Nombre sugerido para el formulario: etiqueta de resultado + escenario + búsqueda. */
export function buildSuggestedName(resultLabel: string, scenario: string, query: string): string {
  const parts: string[] = []
  if (resultLabel) parts.push(resultLabel)
  if (scenario && scenario !== 'ALL') parts.push(scenario)
  const q = query.trim()
  if (q) parts.push(`“${q.slice(0, SAVED_FILTERS_QUERY_MAX)}”`)
  return parts.join(' · ')
}

/**
 * Valida y normaliza la lista leída de localStorage: descarta en
 * silencio lo corrupto (JSON roto, resultado inválido, tipos
 * incorrectos), deduplica por combinación (gana el primero) y
 * respeta el tope de SAVED_FILTERS_MAX.
 */
export function parseSavedFilters(raw: string | null | undefined): SavedFilter[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: SavedFilter[] = []
  for (const item of data) {
    if (out.length >= SAVED_FILTERS_MAX) break
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id.length === 0) continue
    if (typeof r.result !== 'string' || !VALID_RESULTS.includes(r.result as SavedFilterResult)) continue
    if (typeof r.name !== 'string' || typeof r.scenario !== 'string' || typeof r.query !== 'string') continue
    const candidate: SavedFilter = {
      id: r.id,
      name: sanitizeName(r.name),
      result: r.result as SavedFilterResult,
      scenario: r.scenario.slice(0, SAVED_FILTERS_SCENARIO_MAX),
      query: sanitizeQuery(r.query),
      savedAt: typeof r.savedAt === 'string' ? r.savedAt : '',
    }
    if (candidate.name.length === 0) continue
    if (out.some((f) => sameCombination(f, candidate))) continue
    out.push(candidate)
  }
  return out
}

/**
 * Upsert: si la combinación ya existe renombra in situ (sin
 * duplicados); si no, la añade al final. Con la tienda llena se
 * descarta el preset más antiguo para hacer sitio. El generador
 * de id es inyectable para tests deterministas.
 */
export function upsertSavedFilter(
  list: SavedFilter[],
  next: { name: string; result: SavedFilterResult; scenario: string; query: string },
  newId: () => string = () => crypto.randomUUID()
): { list: SavedFilter[]; replaced: boolean } {
  const candidate = {
    name: sanitizeName(next.name),
    result: next.result,
    scenario: next.scenario.slice(0, SAVED_FILTERS_SCENARIO_MAX),
    query: sanitizeQuery(next.query),
  }
  const existing = list.find((f) => sameCombination(f, candidate))
  if (existing) {
    return {
      list: list.map((f) => (f === existing ? { ...f, name: candidate.name } : f)),
      replaced: true,
    }
  }
  const appended: SavedFilter = {
    ...candidate,
    id: newId(),
    savedAt: new Date().toISOString(),
  }
  const grown = [...list, appended]
  while (grown.length > SAVED_FILTERS_MAX) grown.shift()
  return { list: grown, replaced: false }
}

// ── Tienda externa (useSyncExternalStore) ──

const EMPTY: SavedFilter[] = []
const listeners = new Set<() => void>()

// Caché de referencias: getSnapshot debe devolver el MISMO valor
// entre renders si el almacenamiento no cambió, o React entra en
// bucle de re-render infinito.
let cache: { raw: string; value: SavedFilter[] } = { raw: '', value: EMPTY }

function readRaw(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(SAVED_FILTERS_KEY) ?? ''
  } catch {
    return ''
  }
}

export function getSavedFiltersSnapshot(): SavedFilter[] {
  const raw = readRaw()
  if (raw !== cache.raw) cache = { raw, value: parseSavedFilters(raw) }
  return cache.value
}

export function getServerSavedFiltersSnapshot(): SavedFilter[] {
  return EMPTY
}

function emit(): void {
  cache = { raw: '', value: EMPTY }
  for (const listener of listeners) listener()
}

function handleStorageEvent(): void {
  emit()
}

export function subscribeSavedFilters(listener: () => void): () => void {
  listeners.add(listener)
  if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageEvent)
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageEvent)
  }
}

/** Escritura única: normaliza con parseSavedFilters y notifica. */
export function writeSavedFilters(next: SavedFilter[]): void {
  if (typeof window === 'undefined') return
  const value = parseSavedFilters(JSON.stringify(next))
  const raw = JSON.stringify(value)
  try {
    window.localStorage.setItem(SAVED_FILTERS_KEY, raw)
  } catch {
    // cuota llena o almacenamiento bloqueado: la app sigue sin presets
  }
  cache = { raw, value }
  emit()
}

export function newSavedFilterId(): string {
  return crypto.randomUUID()
}

/** Hook de consumo para el panel del historial. */
export function useSavedFilters() {
  const saved = useSyncExternalStore(
    subscribeSavedFilters,
    getSavedFiltersSnapshot,
    getServerSavedFiltersSnapshot
  )
  return {
    saved,
    saveSavedFilter: (next: { name: string; result: SavedFilterResult; scenario: string; query: string }) => {
      const { list } = upsertSavedFilter(getSavedFiltersSnapshot(), next, newSavedFilterId)
      writeSavedFilters(list)
    },
    removeSavedFilter: (id: string) => {
      writeSavedFilters(getSavedFiltersSnapshot().filter((f) => f.id !== id))
    },
  }
}
