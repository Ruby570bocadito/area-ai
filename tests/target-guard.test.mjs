// ─────────────────────────────────────────────────────────────
// Tests unitarios del guard SSRF (src/lib/net/target-guard.ts)
// Versionados en la Ronda 5 (tarea del Director, informe 17h25):
// hasta hoy vivían como script externo del entorno del Director.
// Ejecución: bun test tests/target-guard.test.mjs
// (o bun run test / integrados como Fase 0 del smoke canon)
//
// Diseño hermético: solo IPs literales y hostnames especiales —
// ninguna resolución DNS real, así el test es rápido y estable.
// ─────────────────────────────────────────────────────────────
import { describe, test, expect } from 'bun:test'
import { isPrivateIp, isLocalRequest, classifyTarget } from '../src/lib/net/target-guard'

describe('isPrivateIp — IPv4', () => {
  test('127.0.0.1 loopback es privada', () => expect(isPrivateIp('127.0.0.1')).toBe(true))
  test('10.1.2.3 RFC1918 es privada', () => expect(isPrivateIp('10.1.2.3')).toBe(true))
  test('172.16.0.1 RFC1918 es privada', () => expect(isPrivateIp('172.16.0.1')).toBe(true))
  test('172.32.0.1 NO es privada (fuera de /12)', () => expect(isPrivateIp('172.32.0.1')).toBe(false))
  test('192.168.1.1 RFC1918 es privada', () => expect(isPrivateIp('192.168.1.1')).toBe(true))
  test('169.254.169.254 metadata es privada', () => expect(isPrivateIp('169.254.169.254')).toBe(true))
  test('100.64.0.1 CGNAT es privada', () => expect(isPrivateIp('100.64.0.1')).toBe(true))
  test('0.0.0.0 this-network es privada', () => expect(isPrivateIp('0.0.0.0')).toBe(true))
  test('8.8.8.8 pública NO es privada', () => expect(isPrivateIp('8.8.8.8')).toBe(false))
  test('1.1.1.1 pública NO es privada', () => expect(isPrivateIp('1.1.1.1')).toBe(false))
})

describe('isPrivateIp — IPv6', () => {
  test('::1 loopback es privada', () => expect(isPrivateIp('::1')).toBe(true))
  test('fd00::1 ULA es privada', () => expect(isPrivateIp('fd00::1')).toBe(true))
  test('fe80::1 link-local es privada', () => expect(isPrivateIp('fe80::1')).toBe(true))
  test('::ffff:127.0.0.1 mapeada es privada', () => expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true))
  test('2606:4700::1 pública NO es privada', () => expect(isPrivateIp('2606:4700::1')).toBe(false))
})

describe('isLocalRequest — localidad de la petición vía XFF', () => {
  const headers = (xff) => {
    const h = new Headers()
    if (xff !== null) h.set('x-forwarded-for', xff)
    return h
  }
  test('sin XFF → local (conexión directa)', () => expect(isLocalRequest(headers(null))).toBe(true))
  test('XFF 127.0.0.1 → local', () => expect(isLocalRequest(headers('127.0.0.1'))).toBe(true))
  test('XFF 192.168.1.50 → local (LAN)', () => expect(isLocalRequest(headers('192.168.1.50'))).toBe(true))
  test('XFF 203.0.113.7 → remoto', () => expect(isLocalRequest(headers('203.0.113.7'))).toBe(false))
  test("XFF 'unknown' → remoto (prudente)", () => expect(isLocalRequest(headers('unknown'))).toBe(false))
  test('XFF múltiple 10.0.0.1, 203.0.113.7 → local (primera entrada)', () =>
    expect(isLocalRequest(headers('10.0.0.1, 203.0.113.7'))).toBe(true))
})

describe('classifyTarget — clasificación de destino', () => {
  test('metadata.google.internal → metadata (bloqueado siempre)', async () =>
    expect(await classifyTarget('metadata.google.internal')).toBe('metadata'))
  test('169.254.169.254 literal → metadata', async () =>
    expect(await classifyTarget('169.254.169.254')).toBe('metadata'))
  test('10.0.0.5 literal → private', async () =>
    expect(await classifyTarget('10.0.0.5')).toBe('private'))
  test('8.8.8.8 literal → public', async () =>
    expect(await classifyTarget('8.8.8.8')).toBe('public'))
  test('localhost → private (sin DNS)', async () =>
    expect(await classifyTarget('localhost')).toBe('private'))
  test('ollama.localhost → private (sin DNS)', async () =>
    expect(await classifyTarget('ollama.localhost')).toBe('private'))
  test('api.internal → private (TLD reservado)', async () =>
    expect(await classifyTarget('api.internal')).toBe('private'))
  test('printer.local → private (mDNS)', async () =>
    expect(await classifyTarget('printer.local')).toBe('private'))
})
