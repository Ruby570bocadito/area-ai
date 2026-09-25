// ─────────────────────────────────────────────────────────────
// Guard de SSRF para URLs de proveedor introducidas por el usuario
//
// POST /api/models hace que el SERVIDOR realice una petición a una
// baseUrl arbitraria. Sin control, un atacante con acceso a la app
// podría usarla como proxy hacia la red interna (lab en 127.0.0.1,
// servicios cloud, metadata de nube…).
//
// Política:
//   - Endpoints de metadata de nube: bloqueados SIEMPRE.
//   - Destinos privados (loopback, RFC1918, link-local, ULA…):
//     permitidos solo si la petición llega desde la propia máquina
//     o desde la red local (caso legítimo: Ollama en localhost);
//     bloqueados para peticiones remotas (Internet).
//   - Petición remota: el proveedor debe usar https.
//   - El hostname se resuelve por DNS y se comprueban TODAS las
//     direcciones (mitigación básica de DNS rebinding).
// ─────────────────────────────────────────────────────────────

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/** Hosts de metadata de nube bloqueados siempre (AWS/GCP/Azure/IMDS) */
const ALWAYS_BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'metadata.azure.internal',
])

/** IPs de metadata de nube bloqueadas siempre (IMDS AWS/GCP/Azure y task metadata de ECS) */
const METADATA_IPV4 = new Set(['169.254.169.254', '169.254.170.2'])

/**
 * Extrae el IPv4 embebido de una dirección IPv4-mapped. Cubre TODAS las
 * formas equivalentes: `::ffff:a.b.c.d` (dotted), `::ffff:a9fe:a9fe` (hex —
 * es la forma que `URL.hostname` produce para `[::ffff:169.254.169.254]`)
 * y la forma completa `0:0:0:0:0:ffff:…`. Devuelve null si no es mapped.
 * (Hallazgo Ronda 11 de bugs: la regex previa solo aceptaba la forma dotted,
 * así que la forma hex de la MISMA dirección clasificaba como pública.)
 */
function embeddedIPv4(ip: string): string | null {
  const lower = ip.toLowerCase()
  const dotted = lower.match(/^(?:::|(?:0+:){5})ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (dotted) return dotted[1]
  const hex = lower.match(/^(?:::|(?:0+:){5})ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
  }
  return null
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true // this-network, RFC1918, loopback
  if (a === 169 && b === 254) return true // link-local (incluye metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 192 && b === 0) return true // protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  const embedded = embeddedIPv4(lower)
  if (embedded) return isPrivateIPv4(embedded) // mapped: decide el IPv4 embebido (dotted o hex)
  if (lower === '::' || lower === '::1') return true // unspecified / loopback
  if (/^f[cd]/.test(lower)) return true // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true // fe80::/10 link-local
  if (/^64:ff9b:/.test(lower)) return true // NAT64 well-known prefix (traduce a IPv4 embebido)
  return false
}

/**
 * Clasificación completa de una IP LITERAL: metadata prevalece sobre
 * private (169.254.169.254 es link-local Y metadata — el bloqueo de
 * metadata es SIEMPRE, venga en forma directa o embebida en mapped).
 */
function classifyIp(ip: string): TargetKind {
  const embedded = embeddedIPv4(ip)
  if (embedded && METADATA_IPV4.has(embedded)) return 'metadata'
  if (METADATA_IPV4.has(ip.toLowerCase())) return 'metadata'
  return isPrivateIp(ip) ? 'private' : 'public'
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) return isPrivateIPv4(ip)
  if (v === 6) return isPrivateIPv6(ip)
  return false
}

/**
 * ¿La petición llega desde la máquina/red local?
 * Sin X-Forwarded-For la conexión es directa (uso local, caso soportado).
 * Tras un proxy (Caddy), la primera entrada de XFF es el cliente real.
 */
export function isLocalRequest(headers: Headers): boolean {
  const xff = headers.get('x-forwarded-for')
  if (!xff) return true
  const first = xff.split(',')[0].trim()
  if (first === '') return true
  if (first.toLowerCase() === 'unknown') return false
  return isPrivateIp(first)
}

export type TargetKind = 'metadata' | 'private' | 'public'

/**
 * Firma mínima de la resolución DNS usada por el guard.
 * Se inyecta en classifyTarget para tests herméticos (sin red real)
 * y queda documentada como punto único de resolución del guard.
 */
export type LookupFn = (
  host: string,
  opts: { all: true }
) => Promise<Array<{ address: string; family: number }>>

const dnsLookup: LookupFn = lookup as unknown as LookupFn

// Plazo de resolución DNS (auditoría de timeouts de la Ronda 7):
// un resolver degradado (DNS en blackhole, red rota) no debe colgar a
// los llamadores del guard — las rutas API y el motor LLM esperan esta
// clasificación ANTES de lanzar su propio fetch con timeout, así que un
// lookup sin plazo dejaría la petición entera colgada sin pasar por
// ningún otro plazo. Contrato idéntico al catch: DNS que no resuelve a
// tiempo → 'public' (igual que hoy con NXDOMAIN) y el fallo de conexión
// real lo maneja el fetch de turno con su propio plazo.
const DNS_TIMEOUT_MS = 2500

/**
 * Clasifica el destino por hostname (literal o resuelto por DNS).
 * Si el DNS no resuelve (o no resuelve a tiempo) se devuelve 'public'
 * y el fallo de conexión se maneja en la ruta con su mensaje habitual.
 */
export async function classifyTarget(
  hostname: string,
  lookupFn: LookupFn = dnsLookup
): Promise<TargetKind> {
  // Normalización de literales (hallazgo Ronda 11 de bugs):
  //   · URL.hostname devuelve los literales IPv6 CON corchetes (`[::1]`),
  //     que isIP() no parsea → el intento de DNS falla y degradaba a
  //     'public', BYPASS del guard para `[::1]`, `[fc00::1]` y
  //     `[::ffff:a9fe:a9fe]` (metadata vía IPv4-mapped, que URL normaliza
  //     a hexadecimal).
  //   · Se elimina también el sufijo de zone ID (`fe80::1%eth0`) porque
  //     ninguna DNS name legítima lo contiene.
  const host = hostname
    .toLowerCase()
    .trim()
    .replace(/\.$/, '')
    .replace(/^\[(.+)\]$/, '$1')
    .split('%')[0]

  if (ALWAYS_BLOCKED_HOSTS.has(host)) return 'metadata'

  const literalVersion = isIP(host)
  if (literalVersion !== 0) return classifyIp(host)

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return 'private'
  }

  try {
    const addrs = await new Promise<Array<{ address: string; family: number }>>(
      (resolve, reject) => {
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
      }
    )
    if (addrs.length > 0) {
      let sawPrivate = false
      for (const a of addrs) {
        const kind = classifyIp(a.address)
        if (kind === 'metadata') return 'metadata' // bloqueo SIEMPRE, también vía DNS
        if (kind === 'private') sawPrivate = true
      }
      if (sawPrivate) return 'private'
      return 'public'
    }
    return 'public'
  } catch {
    return 'public'
  }
}
