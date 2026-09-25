// ─────────────────────────────────────────────────────────────
// Tests unitarios del guard SSRF (src/lib/net/target-guard.ts)
//
// Versionados en el repo según el reparto del Director (Ronda 4):
// eran asserts externos del entorno de las rondas 16h40/17h33.
// Runner nativo de Bun — sin dependencias nuevas:
//   bun test tests/
//
// Cubre funciones PURAS (sin red): isPrivateIp e isLocalRequest,
// y classifyTarget solo en los casos que NO requieren DNS
// (hostnames de metadata, literales IP y sufijos reservados).
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { classifyTarget, isLocalRequest, isPrivateIp } from '../src/lib/net/target-guard'

describe('isPrivateIp — IPv4', () => {
  test('loopback', () => expect(isPrivateIp('127.0.0.1')).toBe(true))
  test('this-network 0.0.0.0/8', () => expect(isPrivateIp('0.1.2.3')).toBe(true))
  test('RFC1918 10/8', () => expect(isPrivateIp('10.0.0.1')).toBe(true))
  test('RFC1918 172.16/12 borde inferior', () => expect(isPrivateIp('172.16.0.1')).toBe(true))
  test('RFC1918 172.16/12 borde superior', () => expect(isPrivateIp('172.31.255.255')).toBe(true))
  test('público 172.32.x', () => expect(isPrivateIp('172.32.0.1')).toBe(false))
  test('RFC1918 192.168/16', () => expect(isPrivateIp('192.168.1.1')).toBe(true))
  test('link-local / metadata 169.254.169.254', () => expect(isPrivateIp('169.254.169.254')).toBe(true))
  test('CGNAT 100.64/10 borde inferior', () => expect(isPrivateIp('100.64.0.1')).toBe(true))
  test('CGNAT 100.64/10 borde superior', () => expect(isPrivateIp('100.127.255.254')).toBe(true))
  test('público 100.128.x', () => expect(isPrivateIp('100.128.0.1')).toBe(false))
  test('benchmarking 198.18/15', () => expect(isPrivateIp('198.19.0.1')).toBe(true))
  test('público 198.20.x', () => expect(isPrivateIp('198.20.0.1')).toBe(false))
  test('público 8.8.8.8', () => expect(isPrivateIp('8.8.8.8')).toBe(false))
  test('IPv4 malformado 999.x', () => expect(isPrivateIp('999.1.1.1')).toBe(false))
  test('cadena no IP', () => expect(isPrivateIp('no-es-una-ip')).toBe(false))
})

describe('isPrivateIp — IPv6', () => {
  test('loopback ::1', () => expect(isPrivateIp('::1')).toBe(true))
  test('unspecified ::', () => expect(isPrivateIp('::')).toBe(true))
  test('ULA fc00::/7', () => expect(isPrivateIp('fc00::1')).toBe(true))
  test('ULA fd12::1', () => expect(isPrivateIp('fd12::1')).toBe(true))
  test('link-local fe80::/10', () => expect(isPrivateIp('fe80::1')).toBe(true))
  test('link-local febf::1', () => expect(isPrivateIp('febf::1')).toBe(true))
  test('IPv4-mapped loopback', () => expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true))
  test('IPv4-mapped público', () => expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false))
  test('público global 2001:4860::', () => expect(isPrivateIp('2001:4860:4860::8888')).toBe(false))
})

describe('isLocalRequest', () => {
  const h = (xff?: string) => new Headers(xff ? { 'x-forwarded-for': xff } : {})

  test('sin XFF → conexión directa → local', () => expect(isLocalRequest(h())).toBe(true))
  test('XFF vacío → local', () => expect(isLocalRequest(h(''))).toBe(true))
  test('XFF privado → local', () => expect(isLocalRequest(h('192.168.1.5'))).toBe(true))
  test('XFF loopback → local', () => expect(isLocalRequest(h('127.0.0.1'))).toBe(true))
  test('XFF público → remoto', () => expect(isLocalRequest(h('203.0.113.7'))).toBe(false))
  test('XFF "unknown" → remoto (prudente)', () => expect(isLocalRequest(h('unknown'))).toBe(false))
  test('XFF múltiple: la PRIMERA entrada decide (privada)', () =>
    expect(isLocalRequest(h('10.0.0.1, 203.0.113.7'))).toBe(true))
  test('XFF múltiple: la PRIMERA entrada decide (pública)', () =>
    expect(isLocalRequest(h('203.0.113.7, 10.0.0.1'))).toBe(false))
})

describe('classifyTarget — casos sin DNS', () => {
  test('metadata AWS/GCP por hostname → metadata', async () =>
    expect(await classifyTarget('metadata.google.internal')).toBe('metadata'))
  test('metadata case-insensitive → metadata', async () =>
    expect(await classifyTarget('METADATA.GOOGLE.INTERNAL')).toBe('metadata'))
  test('metadata Azure → metadata', async () =>
    expect(await classifyTarget('metadata.azure.internal')).toBe('metadata'))
  test('metadata GCP por IP literal → metadata', async () =>
    expect(await classifyTarget('169.254.169.254')).toBe('metadata'))
  test('localhost → private', async () => expect(await classifyTarget('localhost')).toBe('private'))
  test('subdominio de localhost → private', async () =>
    expect(await classifyTarget('api.localhost')).toBe('private'))
  test('sufijo .internal → private', async () => expect(await classifyTarget('srv.internal')).toBe('private'))
  test('sufijo .local → private', async () => expect(await classifyTarget('nas.local')).toBe('private'))
  test('IP privada literal → private', async () => expect(await classifyTarget('192.168.1.10')).toBe('private'))
  test('IP pública literal → public', async () => expect(await classifyTarget('8.8.8.8')).toBe('public'))
  test('trailing dot de FQDN se normaliza', async () =>
    expect(await classifyTarget('169.254.169.254.')).toBe('metadata'))
})
