// ─────────────────────────────────────────────────────────────
// safeFetch — fetch saliente a URL de usuario con la IP FIJADA
// (tarea ssrf-ip-pinning: cierre del TOCTOU residual del guard)
//
// El guard (target-guard.ts) clasifica resolviendo DNS, pero el
// `fetch` posterior VUELVE a resolver: un rebinding de TTL bajo
// puede colar en la conexión una IP distinta de la clasificada
// (R13). safeFetch cierra la ventana: resuelve UNA vez, clasifica
// con el mismo criterio y CONECTA a esa IP exacta:
//
//   · http  → fetch nativo a la URL-IP con la cabecera `Host`
//     original (el parser HTTP sigue siendo el del runtime).
//   · https → cliente HTTP/1.1 mínimo sobre node:tls con
//     `servername` = hostname: el TCP va a la IP fijada y el SNI
//     y la verificación del certificado siguen valiendo para el
//     nombre (no por la IP). Decodifica content-length y chunked,
//     con tope de respuesta y plazo total. NO sigue redirects
//     (política del guard desde el origen: un 3xx hacia otro
//     destino podría evadirlo) — un 3xx es error en ambos esquemas.
//
// Errores: SafeFetchError con código acotado — los call-sites los
// mapean a sus mensajes habituales (502 / null) sin filtrar detalle.
// Sin resolución no hay conexión (fail-closed): el guard es el punto
// de cumplimiento, no un aviso previo.
// ─────────────────────────────────────────────────────────────

import { connect as tlsConnect, type TLSSocket } from 'node:tls'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { classifyAddresses, classifyHostname, normalizeHostname, DNS_TIMEOUT_MS, type LookupFn } from './target-guard'

export type SafeFetchErrorCode =
  | 'protocol' // URL no http(s), con credenciales incrustadas o respuesta malformada
  | 'dns-failed' // el nombre no resolvió (o no resolvió a tiempo): sin IP no hay pin
  | 'metadata-blocked' // endpoint de metadata de nube: bloqueo SIEMPRE
  | 'policy-blocked' // el tipo del destino resuelto no está en allowedKinds
  | 'redirect' // 3xx: no se sigue (política anti-evasión del guard)
  | 'timeout' // plazo total agotado
  | 'connect' // fallo de conexión/TLS
  | 'response-too-large' // el cuerpo supera maxResponseBytes

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode
  constructor(code: SafeFetchErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SafeFetchError'
    this.code = code
  }
}

export type SafeAllowedKind = 'private' | 'public'

export interface SafeFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  /** Plazo total de la petición (resolución + conexión + respuesta). 15 s por defecto. */
  timeoutMs?: number
  /** Tope del cuerpo de respuesta leído. 4 MB por defecto. */
  maxResponseBytes?: number
  /**
   * Tipos de destino permitidos tras resolver (metadata está SIEMPRE
   * bloqueada y no se admite aquí). Por defecto ambos: la política fina
   * (privados solo desde red local, https exigido a remotos) la fijan las
   * rutas con sus mensajes 400/403 y safeFetch la re-aplica al conectar.
   */
  allowedKinds?: SafeAllowedKind[]
  /** Inyectable para tests herméticos (misma firma que el guard). */
  lookupFn?: LookupFn
  /** Solo para tests: la producción usa el almacén de CA del sistema. */
  tls?: { ca?: string[]; rejectUnauthorized?: boolean }
}

/** Subconjunto de la interfaz Response que consumen los call-sites. */
export interface SafeResponse {
  status: number
  ok: boolean
  headers: Headers
  text(): Promise<string>
  json(): Promise<unknown>
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const MAX_HEADER_BLOCK_BYTES = 32 * 1024

const dnsLookup: LookupFn = lookup as unknown as LookupFn

/** Plazo aplicado a la resolución DNS del guard (misma auditoría Ronda 7). */
const resolveWithTimeout = async (
  host: string,
  lookupFn: LookupFn
): Promise<Array<{ address: string; family: number }>> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS timeout')), DNS_TIMEOUT_MS)
    lookupFn(host, { all: true }).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (reason) => {
        clearTimeout(timer)
        reject(reason)
      }
    )
  })
}

/** `Host` canónico HTTP/1.1: con puerto solo cuando no es el del esquema. */
function hostHeaderFor(hostname: string, port: number, isHttps: boolean): string {
  const def = isHttps ? 443 : 80
  return port === def ? hostname : `${hostname}:${port}`
}

/** IP formateada para incrustar en una URL (IPv6 entre corchetes). */
function ipForUrl(ip: string): string {
  return isIP(ip) === 6 ? `[${ip}]` : ip
}

function isHeadersLike(h: unknown): h is Record<string, string> {
  return typeof h === 'object' && h !== null
}

/** Cabeceras del llamador sin las que fija la conexión (host/connection). */
function callerHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!isHeadersLike(headers)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase()
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue
    out[k] = v
  }
  return out
}

async function readNativeBodyWithCap(
  body: ReadableStream<Uint8Array> | null,
  cap: number
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  const reader = body.getReader()
  const parts: Buffer[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        size += value.byteLength
        if (size > cap) throw new SafeFetchError('response-too-large', 'El cuerpo de la respuesta supera el tope')
        parts.push(Buffer.from(value))
      }
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(parts)
}

/** Rama http: fetch nativo a la URL-IP con `Host` fijado (pin sin parser propio). */
async function pinnedHttpFetch(
  url: URL,
  pinnedIp: string,
  opts: Required<Pick<SafeFetchOptions, 'timeoutMs' | 'maxResponseBytes'>> & SafeFetchOptions
): Promise<SafeResponse> {
  const port = url.port ? Number(url.port) : 80
  const pinnedUrl = new URL(`http://${ipForUrl(pinnedIp)}:${port}${url.pathname}${url.search}`)
  const res = await fetch(pinnedUrl, {
    method: opts.method ?? 'GET',
    headers: { ...callerHeaders(opts.headers), Host: hostHeaderFor(url.hostname, port, false) },
    body: opts.body,
    // Igual que el guard exige desde el origen: un 3xx podría apuntar
    // a metadata o red interna y evadir el pin (la IP nueva no se fija).
    redirect: 'error',
    signal: AbortSignal.timeout(opts.timeoutMs),
  })
  const text = await readNativeBodyWithCap(res.body, opts.maxResponseBytes)
  const bodyText = text.toString('utf8')
  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  }
}

/**
 * Rama https: HTTP/1.1 mínimo sobre node:tls con la IP fijada.
 * El TCP conecta a `pinnedIp`; el SNI y la verificación del certificado
 * usan `servername` = hostname original (por eso el pin no rompe TLS).
 */
function pinnedHttpsRequest(
  url: URL,
  pinnedIp: string,
  opts: Required<Pick<SafeFetchOptions, 'timeoutMs' | 'maxResponseBytes'>> & SafeFetchOptions
): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const port = url.port ? Number(url.port) : 443
    const method = (opts.method ?? 'GET').toUpperCase()
    const path = `${url.pathname}${url.search}` || '/'
    const hostHeader = hostHeaderFor(url.hostname, port, true)
    const extra = callerHeaders(opts.headers)
    const body = opts.body

    const lines = [`${method} ${path} HTTP/1.1`, `host: ${hostHeader}`, 'connection: close']
    if (body !== undefined) lines.push(`content-length: ${Buffer.byteLength(body)}`)
    else if (method !== 'GET' && method !== 'HEAD') lines.push('content-length: 0')
    for (const [k, v] of Object.entries(extra)) lines.push(`${k.toLowerCase()}: ${v}`)
    // El cuerpo va pegado tras el hueco de cabeceras (content-length ya anunciado)
    const requestText = `${lines.join('\r\n')}\r\n\r\n${body ?? ''}`

    let settled = false
    let headerBuf: Buffer = Buffer.alloc(0)
    let headerDone = false
    let bodyParts: Buffer[] = []
    let bodySize = 0
    let status = 0
    let statusText = ''
    let resHeaders = new Headers()
    let chunked = false
    let chunkRemaining = 0
    let chunkDone = false
    let contentLength = -1

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      socket.destroy()
      fn()
    }

    const fail = (err: SafeFetchError) => finish(() => reject(err))

    const deliver = () => {
      finish(() => {
        const bodyText = Buffer.concat(bodyParts).toString('utf8')
        resolve({
          status,
          ok: status >= 200 && status < 300,
          headers: resHeaders,
          text: async () => bodyText,
          json: async () => JSON.parse(bodyText),
        })
      })
    }

    const checkBodyCap = (incoming: number): boolean => {
      bodySize += incoming
      if (bodySize > opts.maxResponseBytes) {
        fail(new SafeFetchError('response-too-large', 'El cuerpo de la respuesta supera el tope'))
        return false
      }
      return true
    }

    const parseHeaders = (): boolean => {
      const raw = headerBuf.toString('latin1')
      const sep = raw.indexOf('\r\n\r\n')
      if (sep === -1) {
        if (headerBuf.length > MAX_HEADER_BLOCK_BYTES) {
          fail(new SafeFetchError('protocol', 'Bloque de cabeceras de la respuesta demasiado grande'))
        }
        return false
      }
      const head = raw.slice(0, sep)
      const rest = Buffer.from(raw.slice(sep + 4), 'latin1')
      const lines = head.split('\r\n')
      const m = lines[0].match(/^HTTP\/1\.\d (\d{3})(?: (.*))?$/)
      if (!m) {
        fail(new SafeFetchError('protocol', 'Línea de estado HTTP malformada'))
        return false
      }
      status = Number(m[1])
      statusText = m[2] ?? ''
      const pairs: Array<[string, string]> = []
      for (const line of lines.slice(1)) {
        const idx = line.indexOf(':')
        if (idx > 0) pairs.push([line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim()])
      }
      resHeaders = new Headers(pairs)
      chunked = (resHeaders.get('transfer-encoding') ?? '').toLowerCase().includes('chunked')
      const cl = resHeaders.get('content-length')
      contentLength = cl !== null && /^\d+$/.test(cl) ? Number(cl) : -1
      headerDone = true
      // El resto del buffer tras el hueco de cabeceras es cuerpo inicial
      headerBuf = rest
      if (status >= 300 && status < 400) {
        // Política del guard: los proveedores legítimos no redirigen y
        // seguir un 3xx re-resolvería otro destino fuera del pin.
        fail(new SafeFetchError('redirect', `El proveedor respondió una redirección ${status} ${statusText}`.trim()))
        return false
      }
      return true
    }

    /**
     * Decodifica chunked SOBRE EL BUFFER PERSISTENTE (headerBuf acumula
     * entre paquetes — un tamaño de chunk o un CRLF pueden llegar partidos).
     * Consume el prefijo decodificado y devuelve el sufijo pendiente.
     */
    const decodeChunks = (buf: Buffer): Buffer => {
      let off = 0
      for (;;) {
        if (chunkDone) break
        if (chunkRemaining === 0) {
          const nl = buf.indexOf('\r\n', off)
          if (nl === -1) return buf.subarray(off) // falta la línea de tamaño: se conserva
          const sizeLine = buf.subarray(off, nl).toString('latin1').split(';')[0].trim()
          const size = Number.parseInt(sizeLine, 16)
          if (!Number.isInteger(size) || size < 0) {
            fail(new SafeFetchError('protocol', 'Codificación chunked malformada'))
            return Buffer.alloc(0)
          }
          off = nl + 2
          if (size === 0) {
            chunkDone = true
            deliver()
            break
          }
          chunkRemaining = size
        }
        const available = buf.length - off
        if (available <= 0) return buf.subarray(off)
        const take = Math.min(chunkRemaining, available)
        const chunk = buf.subarray(off, off + take)
        off += take
        chunkRemaining -= take
        if (!checkBodyCap(take)) return Buffer.alloc(0)
        bodyParts.push(Buffer.from(chunk))
        if (chunkRemaining === 0 && buf.length - off >= 2) off += 2 // CRLF del chunk
      }
      return buf.subarray(off)
    }

    const consumeBody = () => {
      if (!headerDone || settled) return
      if (chunked) {
        headerBuf = decodeChunks(headerBuf)
        return
      }
      if (headerBuf.length > 0) {
        if (!checkBodyCap(headerBuf.length)) return
        bodyParts.push(headerBuf)
        headerBuf = Buffer.alloc(0)
      }
      if (contentLength >= 0 && bodySize >= contentLength) deliver()
      // content-length -1 (HTTP/1.0 sin length): se entrega al cerrar el socket
    }

    let socket: TLSSocket
    try {
      socket = tlsConnect({
        host: pinnedIp,
        port,
        servername: url.hostname, // SNI y verificación contra el NOMBRE, TCP a la IP
        ...(opts.tls?.ca ? { ca: opts.tls.ca } : {}),
        ...(opts.tls?.rejectUnauthorized !== undefined
          ? { rejectUnauthorized: opts.tls.rejectUnauthorized }
          : {}),
      })
    } catch (e) {
      reject(new SafeFetchError('connect', 'No se pudo abrir la conexión TLS', { cause: e }))
      return
    }

    const deadline = setTimeout(() => {
      fail(new SafeFetchError('timeout', 'Tiempo de espera agotado con el proveedor'))
    }, opts.timeoutMs)

    socket.setTimeout(opts.timeoutMs)
    socket.on('timeout', () => fail(new SafeFetchError('timeout', 'Tiempo de espera agotado con el proveedor')))
    socket.on('error', (e) => fail(new SafeFetchError('connect', 'Fallo de conexión TLS con el proveedor', { cause: e })))
    const laxTls = opts.tls?.rejectUnauthorized === false
    socket.on('secureConnect', () => {
      if (!laxTls && !socket.authorized) {
        // rejectUnauthorized=true ya emite 'error' antes; cinturón para builds raros
        fail(new SafeFetchError('connect', 'Certificado del proveedor no válido'))
        return
      }
      socket.write(requestText)
    })
    socket.on('data', (chunk: Buffer) => {
      if (settled) return
      if (!headerDone) {
        headerBuf = Buffer.concat([headerBuf, chunk])
        if (!parseHeaders()) return
        consumeBody()
        return
      }
      if (chunked) {
        headerBuf = Buffer.concat([headerBuf, chunk])
        headerBuf = decodeChunks(headerBuf)
      } else {
        if (!checkBodyCap(chunk.length)) return
        bodyParts.push(chunk)
        if (contentLength >= 0 && bodySize >= contentLength) deliver()
      }
    })
    socket.on('close', () => {
      if (settled) return
      if (!headerDone) {
        fail(new SafeFetchError('connect', 'Conexión cerrada antes de respuesta'))
        return
      }
      if (chunked && !chunkDone) {
        fail(new SafeFetchError('protocol', 'Respuesta chunked truncada'))
        return
      }
      deliver() // HTTP/1.0 sin content-length: fin por cierre
    })
  })
}

/**
 * fetch con pin de IP: resuelve UNA vez, clasifica (metadata SIEMPRE
 * bloqueada; allowedKinds por llamador) y conecta a la IP resuelta.
 * Sin resolución no hay conexión: DNS que falla → 'dns-failed' (más
 * estricto que classifyTarget, que degrada a 'public' para dejar que
 * el fetch de turno reporte el fallo — aquí la resolución ES el pin).
 */
export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const opts = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    allowedKinds: options.allowedKinds ?? (['private', 'public'] as SafeAllowedKind[]),
    headers: options.headers,
    body: options.body,
    method: options.method,
    lookupFn: options.lookupFn ?? dnsLookup,
    tls: options.tls,
  }

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new SafeFetchError('protocol', 'URL del proveedor inválida')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('protocol', 'El protocolo debe ser http(s)')
  }
  if (url.username || url.password) {
    throw new SafeFetchError('protocol', 'La URL no debe incluir credenciales (usa la cabecera de autorización)')
  }
  const isHttps = url.protocol === 'https:'

  // Misma normalización y clasificación por hostname que classifyTarget
  // (Ronda 11: los corchetes IPv6 que URL.hostname conserva y los zone ids
  // no son DNS). La pieza es compartida con el guard: hosts de metadata y
  // sufijos reservados se deciden SIN tocar la red.
  const host = normalizeHostname(url.hostname)
  if (classifyHostname(host) === 'metadata') {
    throw new SafeFetchError('metadata-blocked', 'Destino bloqueado: endpoint de metadata de nube')
  }

  let pinnedIp: string
  if (isIP(host) !== 0) {
    // Literal IP: no hay DNS y por tanto nada que re-resolver → pin directo
    pinnedIp = host
    if (!opts.allowedKinds.includes(classifyHostname(host) as SafeAllowedKind)) {
      throw new SafeFetchError('policy-blocked', 'Destino privado bloqueado por la política del llamador')
    }
  } else {
    let addrs: Array<{ address: string; family: number }>
    try {
      addrs = await resolveWithTimeout(host, opts.lookupFn)
    } catch {
      throw new SafeFetchError('dns-failed', 'El nombre del proveedor no se pudo resolver')
    }
    if (!addrs || addrs.length === 0) {
      throw new SafeFetchError('dns-failed', 'El nombre del proveedor no resolvió a ninguna dirección')
    }
    // Peor caso de TODAS las direcciones (misma agregación del guard):
    // metadata SIEMPRE bloqueada (precede a la política del llamador) y
    // ninguna conexión si el lote toca una privada no permitida
    const kind = classifyAddresses(addrs)
    if (kind === 'metadata') throw new SafeFetchError('metadata-blocked', 'Destino bloqueado: endpoint de metadata de nube')
    if (!opts.allowedKinds.includes(kind as SafeAllowedKind)) {
      throw new SafeFetchError('policy-blocked', `Destino ${kind} bloqueado por la política del llamador`)
    }
    pinnedIp = addrs[0].address
  }

  try {
    if (isHttps) return await pinnedHttpsRequest(url, pinnedIp, opts)
    return await pinnedHttpFetch(url, pinnedIp, opts)
  } catch (e) {
    if (e instanceof SafeFetchError) throw e
    // fetch nativo: TimeoutError del AbortSignal / TypeError de red o redirect
    const name = e instanceof Error ? e.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new SafeFetchError('timeout', 'Tiempo de espera agotado con el proveedor', { cause: e })
    }
    if (name === 'TypeError' && String((e as Error | undefined)?.message ?? '').toLowerCase().includes('redirect')) {
      throw new SafeFetchError('redirect', 'El proveedor respondió una redirección (no se sigue)', { cause: e })
    }
    // Bun señala los redirects en modo 'error' con code UnexpectedRedirect
    if ((e as { code?: string } | null)?.code === 'UnexpectedRedirect') {
      throw new SafeFetchError('redirect', 'El proveedor respondió una redirección (no se sigue)', { cause: e })
    }
    throw new SafeFetchError('connect', 'No se pudo conectar con el proveedor', { cause: e })
  }
}
