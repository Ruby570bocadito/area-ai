// ─────────────────────────────────────────────────────────────
// Tests unitarios del control de acceso opcional
// (src/lib/net/access.ts — riesgo R4, ronda 17h08)
//
// Versionados en el repo según el reparto del Director (Ronda 4):
// eran tests externos del entorno. Runner nativo de Bun:
//   bun test tests/
//
// Cubre: modo abierto sin ADMIN_TOKEN, acreditación por cabecera
// y por cookie, rechazo de token incorrecto, comparación de
// tiempo constante, rate limit de ventana deslizante y clientKey.
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test'
import { clientKey, isMutationAuthorized, rateLimit } from '../src/lib/net/access'

const TOKEN = 'secreto-de-prueba-1234'

function setToken(value: string | undefined) {
  if (value === undefined) delete process.env.ADMIN_TOKEN
  else process.env.ADMIN_TOKEN = value
}

afterEach(() => setToken(undefined))

describe('isMutationAuthorized — modo abierto', () => {
  test('sin ADMIN_TOKEN → acceso abierto (UX local intacta)', () => {
    setToken(undefined)
    expect(isMutationAuthorized(new Headers())).toBe(true)
  })
})

describe('isMutationAuthorized — con ADMIN_TOKEN', () => {
  test('sin credenciales → 401 lógico (false)', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers())).toBe(false)
  })

  test('cabecera X-Admin-Token correcta → autorizado', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ 'x-admin-token': TOKEN }))).toBe(true)
  })

  test('cabecera X-Admin-Token incorrecta → denegado', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ 'x-admin-token': 'otro-token' }))).toBe(false)
  })

  test('cookie admin_token correcta → autorizado', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ cookie: `other=1; admin_token=${TOKEN}` }))).toBe(true)
  })

  test('cookie con valor URL-encoded → autorizado (decodeURIComponent)', () => {
    setToken('tok en/con espacio')
    expect(isMutationAuthorized(new Headers({ cookie: 'admin_token=tok%20en%2Fcon%20espacio' }))).toBe(true)
  })

  test('cookie admin_token incorrecta → denegado', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ cookie: 'admin_token=no' }))).toBe(false)
  })

  test('la cabecera tiene prioridad sobre la cookie', () => {
    setToken(TOKEN)
    const headers = new Headers({
      'x-admin-token': TOKEN,
      cookie: 'admin_token=incorrecto',
    })
    expect(isMutationAuthorized(headers)).toBe(true)
  })

  test('token vacío en entorno NO activa el modo protegido (falsy → abierto)', () => {
    setToken('')
    expect(isMutationAuthorized(new Headers())).toBe(true)
  })

  test('comparación de tiempo constante: longitudes distintas → denegado sin filtrar', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ 'x-admin-token': 'corto' }))).toBe(false)
    expect(isMutationAuthorized(new Headers({ 'x-admin-token': `${TOKEN}extra` }))).toBe(false)
  })
})

describe('rateLimit — ventana deslizante', () => {
  test('permite hasta max peticiones y bloquea la siguiente', () => {
    const key = `test-a-${Math.random()}`
    for (let i = 0; i < 6; i++) expect(rateLimit(key, 6, 60_000)).toBe(true)
    expect(rateLimit(key, 6, 60_000)).toBe(false)
    expect(rateLimit(key, 6, 60_000)).toBe(false)
  })

  test('otro cliente (otra clave) no se ve afectado', () => {
    const a = `test-b-${Math.random()}`
    const b = `test-c-${Math.random()}`
    for (let i = 0; i < 6; i++) rateLimit(a, 6, 60_000)
    expect(rateLimit(a, 6, 60_000)).toBe(false)
    expect(rateLimit(b, 6, 60_000)).toBe(true)
  })

  test('max configurable por llamada', () => {
    const key = `test-d-${Math.random()}`
    expect(rateLimit(key, 2, 60_000)).toBe(true)
    expect(rateLimit(key, 2, 60_000)).toBe(true)
    expect(rateLimit(key, 2, 60_000)).toBe(false)
  })

  test('expirada la ventana, vuelve a permitir (margen amplio para CI lento)', async () => {
    const key = `test-e-${Math.random()}`
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 40)).toBe(true)
    expect(rateLimit(key, 3, 40)).toBe(false)
    await new Promise((r) => setTimeout(r, 120))
    expect(rateLimit(key, 3, 40)).toBe(true)
  })
})

describe('clientKey — confianza en XFF bajo TRUST_PROXY', () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY
  })

  test('sin XFF → "direct" (conexión directa)', () => expect(clientKey(new Headers())).toBe('direct'))

  test('por defecto (sin proxy de confianza) XFF se IGNORA aunque venga → "direct"', () => {
    // cualquier cliente puede enviar X-Forwarded-For arbitraria: sin proxy de
    // confianza declarado, esa cabecera NO es identidad fiable para el límite
    expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('direct')
  })

  test('rotar XFF por petición NO rota la clave de rate limit sin TRUST_PROXY', () => {
    for (const ip of ['203.0.113.7', '198.51.100.2', '10.0.0.9']) {
      expect(clientKey(new Headers({ 'x-forwarded-for': ip }))).toBe('direct')
    }
  })

  test('TRUST_PROXY=1 → primera entrada de XFF', () => {
    process.env.TRUST_PROXY = '1'
    expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  test('TRUST_PROXY=1 con espacios → recortado', () => {
    process.env.TRUST_PROXY = '1'
    expect(clientKey(new Headers({ 'x-forwarded-for': ' 198.51.100.2 ' }))).toBe('198.51.100.2')
  })

  test('TRUST_PROXY con otro valor ("true", "0", "yes", vacío) NO activa la confianza', () => {
    for (const value of ['true', '0', 'yes', '']) {
      process.env.TRUST_PROXY = value
      expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('direct')
    }
  })
})
