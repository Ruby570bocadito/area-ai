// ─────────────────────────────────────────────────────────────
// Control de acceso OPCIONAL para endpoints que mutan estado
// (POST /api/campaigns, /api/autopilot, /api/settings, /api/models)
//
// Diseño (decisión de la Ronda 3, riesgo R4):
//   - Si ADMIN_TOKEN no está definido en el entorno → acceso
//     abierto. Comportamiento local por defecto, UX intacta.
//   - Si ADMIN_TOKEN está definido → las peticiones deben
//     acreditarlo vía cabecera `X-Admin-Token` o cookie
//     `admin_token` (permite habilitar el navegador una sola vez
//     sin tocar la UI).
//   - Los GET de datos permanecen abiertos: exponen datos de
//     simulación, no secretos (la API key del proveedor ya se
//     devuelve enmascarada).
//
// Es defensa en profundidad para despliegues no locales; la
// recomendación principal sigue siendo no exponer la app a
// Internet (ver README, sección Seguridad).
// ─────────────────────────────────────────────────────────────

export const ADMIN_TOKEN_HEADER = 'x-admin-token'
export const ADMIN_TOKEN_COOKIE = 'admin_token'

export function isMutationAuthorized(headers: Headers): boolean {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return true // modo local abierto (caso soportado)

  const provided = headers.get(ADMIN_TOKEN_HEADER) ?? getCookie(headers, ADMIN_TOKEN_COOKIE)
  if (!provided) return false
  // comparación de tiempo constante para evitar oracles de timing
  return timingSafeEqual(provided, expected)
}

function getCookie(headers: Headers, name: string): string | null {
  const raw = headers.get('cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) {
      // Entrada no fiable del cliente: un valor malformado (`admin_token=%`,
      // escapes inválidos) lanzaba URIError y convertía el rechazo 401 en un
      // 500 en TODOS los endpoints de mutación (hallazgo Ronda 11 de bugs).
      // Una cookie rota debe degradar a "sin credencial", nunca a error.
      try {
        return decodeURIComponent(rest.join('='))
      } catch {
        return null
      }
    }
  }
  return null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // compara igualmente para no filtrar longitud por timing
    dummyCompare(a, b)
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function dummyCompare(a: string, b: string): void {
  let d = 0
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  if (d === 0 && a !== b) d = 1 // nunca ocurre; evita optimizaciones triviales
}

// ─────────────────────────────────────────────────────────────
// Rate limit en memoria para POST /api/campaigns: evita que un
// cliente lance campañas en bucle (gasto de créditos LLM).
// Válido para despliegue de proceso único (standalone/bun), que
// es el modelo soportado del proyecto.
// ─────────────────────────────────────────────────────────────

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6

const hits = new Map<string, number[]>()

export function rateLimit(key: string, max = MAX_PER_WINDOW, windowMs = WINDOW_MS): boolean {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) {
    hits.set(key, list)
    return false
  }
  list.push(now)
  hits.set(key, list)
  // limpieza perezosa para no crecer indefinidamente
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k)
    }
  }
  return true
}

/**
 * Clave de cliente para el rate limit.
 *
 * La cabecera X-Forwarded-For la fija el PRIMER salto y cualquier cliente
 * puede enviarla arbitrariamente: si se confía en ella sin proxy de
 * confianza delante, un atacante rota su clave de rate limit a voluntad
 * (una IP falsa por petición = límite anulado). Por eso solo se usa XFF
 * cuando el operador declara explícitamente que hay un proxy de confianza
 * (`TRUST_PROXY=1`, p. ej. detrás del Caddyfile de este repo, que fija
 * `X-Forwarded-For {remote_host}`). Sin él → clave única "direct": el
 * límite pasa a ser global (más severo, nunca más débil que la verdad).
 */
export function clientKey(headers: Headers): string {
  if (process.env.TRUST_PROXY === '1') {
    const xff = headers.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
  }
  return 'direct'
}
