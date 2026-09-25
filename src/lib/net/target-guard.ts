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
  const mapped = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/) // IPv4-mapped
  if (mapped) return isPrivateIPv4(mapped[1])
  if (lower === '::' || lower === '::1') return true // unspecified / loopback
  if (/^f[cd]/.test(lower)) return true // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true // fe80::/10 link-local
  return false
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
 * Clasifica el destino por hostname (literal o resuelto por DNS).
 * Si el DNS no resuelve se devuelve 'public' y el fallo de conexión
 * se maneja en la ruta con su mensaje habitual.
 */
export async function classifyTarget(hostname: string): Promise<TargetKind> {
  const host = hostname.toLowerCase().replace(/\.$/, '')

  if (ALWAYS_BLOCKED_HOSTS.has(host)) return 'metadata'
  if (host === '169.254.169.254') return 'metadata'

  const literalVersion = isIP(host)
  if (literalVersion !== 0) return isPrivateIp(host) ? 'private' : 'public'

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return 'private'
  }

  try {
    const addrs = await lookup(host, { all: true })
    if (addrs.some((a) => isPrivateIp(a.address))) return 'private'
    return 'public'
  } catch {
    return 'public'
  }
}
