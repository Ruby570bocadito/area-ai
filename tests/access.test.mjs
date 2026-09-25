// ─────────────────────────────────────────────────────────────
// Tests unitarios del control de acceso opcional
// (src/lib/net/access.ts): rate limit + token de administración.
// Versionados en la Ronda 5 (tarea del Director, informe 17h25).
// Ejecución: bun test tests/access.test.mjs
//
// Notas de diseño:
//  - El mapa del rate limit es estado de módulo → claves únicas
//    por test para evitar interferencias entre casos y ejecuciones.
//  - ADMIN_TOKEN se guarda/restaura para no contaminar otros tests.
// ─────────────────────────────────────────────────────────────
import { describe, test, expect, afterAll, beforeEach } from 'bun:test'
import { rateLimit, clientKey, isMutationAuthorized, ADMIN_TOKEN_HEADER, ADMIN_TOKEN_COOKIE } from '../src/lib/net/access'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

describe('rateLimit — ventana deslizante en memoria', () => {
  test('permite hasta max y bloquea la siguiente', () => {
    const key = `rl-cap-${Date.now()}`
    expect(rateLimit(key, 3, 60_000)).toBe(true)
    expect(rateLimit(key, 3, 60_000)).toBe(true)
    expect(rateLimit(key, 3, 60_000)).toBe(true)
    expect(rateLimit(key, 3, 60_000)).toBe(false)
  })
  test('otro cliente (otra clave) no se ve afectado', () => {
    const a = `rl-a-${Date.now()}`
    const b = `rl-b-${Date.now()}`
    expect(rateLimit(a, 1, 60_000)).toBe(true)
    expect(rateLimit(a, 1, 60_000)).toBe(false)
    expect(rateLimit(b, 1, 60_000)).toBe(true)
  })
  test('tras expirar la ventana vuelve a permitir', async () => {
    const key = `rl-exp-${Date.now()}`
    expect(rateLimit(key, 1, 120)).toBe(true)
    expect(rateLimit(key, 1, 120)).toBe(false)
    await sleep(180) // > ventana: determinista aunque el host sea lento
    expect(rateLimit(key, 1, 120)).toBe(true)
  })
})

describe('clientKey — clave de cliente para el limitador', () => {
  test('con XFF usa la primera entrada', () =>
    expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7'))
  test('sin XFF es conexión directa', () =>
    expect(clientKey(new Headers())).toBe('direct'))
})

describe('isMutationAuthorized — token opcional', () => {
  const ORIGINAL = process.env.ADMIN_TOKEN
  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = ORIGINAL
  })

  test('sin ADMIN_TOKEN en el entorno → acceso abierto (modo local)', () => {
    delete process.env.ADMIN_TOKEN
    expect(isMutationAuthorized(new Headers())).toBe(true)
  })

  describe('con ADMIN_TOKEN definido', () => {
    beforeEach(() => {
      process.env.ADMIN_TOKEN = 'secreto-campaña-2026'
    })

    test('sin cabecera ni cookie → denegado', () =>
      expect(isMutationAuthorized(new Headers())).toBe(false))
    test(`token correcto por ${ADMIN_TOKEN_HEADER} → autorizado`, () =>
      expect(isMutationAuthorized(new Headers({ [ADMIN_TOKEN_HEADER]: 'secreto-campaña-2026' }))).toBe(true))
    test('token incorrecto → denegado', () =>
      expect(isMutationAuthorized(new Headers({ [ADMIN_TOKEN_HEADER]: 'no-es-el-token' }))).toBe(false))
    test('token de longitud distinta → denegado (sin filtrar longitud)', () =>
      expect(isMutationAuthorized(new Headers({ [ADMIN_TOKEN_HEADER]: 'corto' }))).toBe(false))
    test(`token correcto por cookie ${ADMIN_TOKEN_COOKIE} → autorizado`, () =>
      expect(isMutationAuthorized(new Headers({ cookie: `${ADMIN_TOKEN_COOKIE}=secreto-campa%C3%B1a-2026` }))).toBe(true))
    test('cookie con valor incorrecto → denegado', () =>
      expect(isMutationAuthorized(new Headers({ cookie: `${ADMIN_TOKEN_COOKIE}=otro` }))).toBe(false))
  })
})
