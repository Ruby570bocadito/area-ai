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
// Verificación de same-origin para mutaciones (CSRF).
//
// (Hallazgo Ronda 12 de bugs) Las mutaciones se protegían solo con
// ADMIN_TOKEN; en modo local abierto (caso soportado por defecto, R4)
// una página maliciosa podía lanzar POST cross-site contra
// http://localhost:3000 SIN preflight usando `Content-Type: text/plain`
// (Request.json() parsea el cuerpo con independencia del Content-Type):
//   · POST /api/campaigns → lanzar campañas (gasto LLM).
//   · POST /api/autopilot → activar el modo continuo (gasto LLM en bucle).
//   · POST /api/settings  → redirigir el proveedor LLM a un proxy propio
//     (exfiltraría la API key en el siguiente uso del motor).
// El POST cross-site de formulario es "simple" (text/plain) y no dispara
// CORS preflight; la única barrera era SameSite=Lax de la cookie, que solo
// aplica cuando ADMIN_TOKEN está definido (y la UI usa X-Admin-Token).
//
// Regla (compatible con clientes no-navegador):
//   · Sin cabecera Origin → PERMITIR (curl, humo de pruebas,
//     scripts de verificación, server-to-server). El navegador envía
//     Origin en todo POST, así que esta rama nunca aplica a un navegador.
//   · Origin: null → RECHAZAR (iframe arenero, redirects cross-origin).
//   · Origin con host distinto del Host de la petición → RECHAZAR.
//     El Caddyfile del repo preserva el Host (`header_up Host {host}`),
//     así que la comparación también es válida tras el proxy. Solo se
//     compara host[:puerto], no el esquema (http de apoyo y https
//     públicos comparten host en el despliegue documentado).
// ─────────────────────────────────────────────────────────────

export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin')
  if (origin === null) return true // cliente no-navegador
  if (origin === 'null') return false // sandbox/redirect: nunca es la UI
  const host = headers.get('host')
  if (!host) return false // sin Host no se puede acreditar el origen
  try {
    return new URL(origin).host === host.trim().toLowerCase()
  } catch {
    return false // Origin no parseable → no acreditado
  }
}

// ─────────────────────────────────────────────────────────────
// Tope de tamaño de cuerpo ANTES de parsear (DoS de memoria).
//
// (Hallazgo Ronda 12 de bugs) Los route handlers parsean el cuerpo
// completo en memoria (`req.json()`) antes de cualquier validación de
// tamaño: un cliente podía POSTear cientos de MB/GB y agotar la memoria
// del proceso único. Con Content-Length presente se rechaza de entrada;
// las peticiones chunked sin Content-Length se acotan al consumir el
// stream con `readJsonBody` (abajo), que cierra la limitación que este
// módulo tenía documentada.
// ─────────────────────────────────────────────────────────────

export function contentLengthExceeds(headers: Headers, maxBytes: number): boolean {
  const raw = headers.get('content-length')
  if (!raw) return false // chunked / sin longitud: se acota tras el parseo
  const n = Number(raw)
  return Number.isFinite(n) && n > maxBytes
}

// ─────────────────────────────────────────────────────────────
// Lectura del cuerpo JSON con tope APLICADO AL STREAM.
//
// (Tarea cuerpo-chunked del ROADMAP) `contentLengthExceeds` acota
// solo cuando el cliente declara Content-Length; las peticiones
// `chunked` (Transfer-Encoding: chunked, sin esa cabecera) se
// parseaban íntegras en memoria, y la limitación quedó documentada
// en el README como no acotable "sin consumir el stream". Este
// ayudante consume el stream EXACTAMENTE con ese tope: acumula
// trozos hasta maxBytes y, al superarlo, cancela la lectura y
// rechaza — un cuerpo chunked de gigas ya no puede agotar la
// memoria del proceso único. El chequeo de Content-Length se
// mantiene como vía rápida (rechaza antes de tocar el stream).
// ─────────────────────────────────────────────────────────────

export type BodyParseResult<T> =
  | { ok: true; body: T }
  | { ok: false; reason: 'too-large' | 'invalid' }

export async function readJsonBody<T>(req: Request, maxBytes: number): Promise<BodyParseResult<T>> {
  // Vía rápida: Content-Length presente y por encima del tope.
  if (contentLengthExceeds(req.headers, maxBytes)) return { ok: false, reason: 'too-large' }

  const reader = req.body?.getReader()
  if (!reader) return { ok: true, body: {} as T } // sin cuerpo → objeto vacío

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      try {
        await reader.cancel() // deja de consumir: el socket no acumula más
      } catch {
        // cancel puede rechazar si el cliente ya cortó; indiferente aquí
      }
      return { ok: false, reason: 'too-large' }
    }
    chunks.push(value)
  }

  const buf = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    buf.set(c, offset)
    offset += c.byteLength
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(buf)) as T }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
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
