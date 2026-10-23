// ─────────────────────────────────────────────────────────────
// Dedupe de lanzamiento en servidor — POST /api/campaigns.
//
// Tarea ROADMAP idempotencia-lanzamiento ([S], [verificar]
// confirmado): el cerrojo de confirmacion-lanzamiento es SOLO
// cliente; el guard de RUNNING en el motor cubre el doble clic
// secuencial, pero dos peticiones que se cruzan creaban dos
// campañas (TOCTOU, ver src/lib/sim/launch-lock.ts). Esta capa
// añade la mitad de idempotencia: REPETIR la misma petición no
// lanza una segunda campaña, devuelve la respuesta original.
//
// Dos llaves de dedupe, por orden de precisión:
//   1. `Idempotency-Key` (header): el cliente declara «este
//      lanzamiento lógico». Ventana larga (10 min) — cubre el
//      reintento tras un timeout de red. Replay exacto.
//   2. Hash del cuerpo (sin header): ventana CORTA (5 s) — cierra
//      el doble clic a ciegas (dos POST idénticos seguidos, el
//      caso curl/script). Cuerpo y ausencia de cuerpo se
//      normalizan a `{}`: semánticamente es el mismo lanzamiento.
//
// Solo se archivan respuestas 200 (el lanzamiento ES el recurso
// que se protege; un 409/429/500 no creó nada y el reintento debe
// recomputarse). Memoria acotada (MAX_ENTRIES + purga perezosa),
// patrón access.ts. In-process: un reinicio vacía el archivo —
// irrelevante en la ventana de un doble clic.
// ─────────────────────────────────────────────────────────────

import { createHash } from 'crypto'

/** Ventana de replay para peticiones con Idempotency-Key explícita. */
export const KEY_TTL_MS = 10 * 60_000

/** Ventana corta del dedupe por cuerpo idéntico (escala del doble clic). */
export const BODY_WINDOW_MS = 5_000

/** Tope de entradas archivadas (purga perezosa al insertar). */
export const MAX_ENTRIES = 256

/** Longitud máxima de una Idempotency-Key aceptada. */
export const MAX_KEY_LENGTH = 128

export interface LaunchRecord {
  status: number
  body: unknown
  storedAt: number
}

const archivo = new Map<string, LaunchRecord>()

/**
 * Resuelve la llave de dedupe de un lanzamiento:
 *   · header `Idempotency-Key` (trim, ≤ 128 chars) → `key:<valor>`
 *   · si no, hash del cuerpo normalizado → `body:<sha256>`
 * Cuerpo ausente/undefined se normaliza a `{}` (mismo lanzamiento
 * lógico que el POST vacío del botón). Devuelve null solo si el
 * header llega vacío — caso degenerado que no merece dedupe.
 */
export function resolveDedupeKey(headers: Headers, launchBody: unknown): string | null {
  const explícita = headers.get('Idempotency-Key')?.trim()
  if (explícita) {
    if (explícita.length === 0 || explícita.length > MAX_KEY_LENGTH) return null
    return `key:${explícita}`
  }
  const canon = JSON.stringify(launchBody ?? {})
  const hash = createHash('sha256').update(canon).digest('hex')
  return `body:${hash}`
}

/**
 * Busca una respuesta archivada VIGENTE para la llave. `now` entra
 * por parámetro (testeable). La llave `body:` solo es válida dentro
 * de BODY_WINDOW_MS; la `key:` dentro de KEY_TTL_MS.
 */
export function findLaunch(key: string, now: number = Date.now()): LaunchRecord | null {
  const rec = archivo.get(key)
  if (!rec) return null
  const ttl = key.startsWith('key:') ? KEY_TTL_MS : BODY_WINDOW_MS
  if (now - rec.storedAt >= ttl) {
    archivo.delete(key)
    return null
  }
  return rec
}

/** Archiva una respuesta de lanzamiento (solo 200) y purga si desborda. */
export function recordLaunch(key: string, status: number, body: unknown, now: number = Date.now()): void {
  if (status !== 200) return // solo el éxito es el recurso que se protege
  archivo.set(key, { status, body, storedAt: now })
  if (archivo.size > MAX_ENTRIES) {
    // Purga perezosa: expirados primero; si aún desborda (llaves
    // key: largas vivas), expulsa los más viejos en orden de inserción.
    for (const [k, rec] of archivo) {
      if (archivo.size <= MAX_ENTRIES) break
      const ttl = k.startsWith('key:') ? KEY_TTL_MS : BODY_WINDOW_MS
      if (now - rec.storedAt >= ttl) archivo.delete(k)
    }
    while (archivo.size > MAX_ENTRIES) {
      const másVieja = archivo.keys().next().value
      if (másVieja === undefined) break
      archivo.delete(másVieja)
    }
  }
}

/** Vacía el archivo (uso en tests). */
export function clearLaunches(): void {
  archivo.clear()
}
