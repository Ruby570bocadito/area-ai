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
import {
  adminTokenMatches,
  clientKey,
  contentLengthExceeds,
  isMutationAuthorized,
  isSameOrigin,
  rateLimit,
  readJsonBody,
} from '../src/lib/net/access'

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

// ─────────────────────────────────────────────────────────────
// Regresión Ronda 11 de bugs — cookie malformada y rate limit
// de mutaciones admin.
// ─────────────────────────────────────────────────────────────

describe('cookie malformada (regresión Ronda 11)', () => {
  test('valor con escape inválido → denegado SIN lanzar (antes: URIError → 500)', () => {
    setToken(TOKEN)
    // '%' sin dígitos hex lanzaba URIError en decodeURIComponent
    expect(() =>
      isMutationAuthorized(new Headers({ cookie: `admin_token=%` }))
    ).not.toThrow()
    expect(isMutationAuthorized(new Headers({ cookie: `admin_token=%` }))).toBe(false)
  })

  test('valor con secuencia inválida `%zz` → denegado sin lanzar', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ cookie: `admin_token=%zz${TOKEN}` }))).toBe(false)
  })

  test('cookie bien formada sigue acreditando (regresión del fix)', () => {
    setToken(TOKEN)
    expect(isMutationAuthorized(new Headers({ cookie: `admin_token=${TOKEN}` }))).toBe(true)
  })

  test('escape válido (%2F) se decodifica correctamente', () => {
    setToken('tok/en-1') // token con '/', se envía escapado %2F
    expect(isMutationAuthorized(new Headers({ cookie: 'admin_token=tok%2Fen-1' }))).toBe(true)
  })
})

describe('rateLimit — bucket compartido de mutaciones admin (Ronda 11)', () => {
  test('claves distintas son buckets independientes', () => {
    expect(rateLimit('admin:a', 2, 60_000)).toBe(true)
    expect(rateLimit('admin:a', 2, 60_000)).toBe(true)
    expect(rateLimit('admin:a', 2, 60_000)).toBe(false)
    expect(rateLimit('admin:b', 2, 60_000)).toBe(true) // no comparte con a
  })
})

// ─────────────────────────────────────────────────────────────
// Regresión Ronda 12 de bugs — same-origin (CSRF) y tope de
// cuerpo pre-parse.
// ─────────────────────────────────────────────────────────────

describe('isSameOrigin — CSRF en mutaciones (Ronda 12)', () => {
  test('sin cabecera Origin → permitido (curl, humo, verificación server-side)', () => {
    expect(isSameOrigin(new Headers({ host: 'localhost:3000' }))).toBe(true)
    expect(isSameOrigin(new Headers())).toBe(true)
  })

  test('Origin mismo host:puerto → permitido (UI same-origin)', () => {
    expect(
      isSameOrigin(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }))
    ).toBe(true)
  })

  test('Origin mismo host sin puerto explícito → permitido (puerto por defecto)', () => {
    expect(isSameOrigin(new Headers({ origin: 'http://example.com', host: 'example.com' }))).toBe(true)
  })

  test('Origin distinto host → rechazado (cross-site)', () => {
    expect(
      isSameOrigin(new Headers({ origin: 'http://evil.example', host: 'localhost:3000' }))
    ).toBe(false)
  })

  test('Origin mismo host, puerto distinto → rechazado', () => {
    expect(
      isSameOrigin(new Headers({ origin: 'http://localhost:3001', host: 'localhost:3000' }))
    ).toBe(false)
  })

  test('Origin: null (iframe arenero) → rechazado', () => {
    expect(isSameOrigin(new Headers({ origin: 'null', host: 'localhost:3000' }))).toBe(false)
  })

  test('Origin no parseable → rechazado sin lanzar', () => {
    expect(isSameOrigin(new Headers({ origin: 'http://[::1', host: 'localhost:3000' }))).toBe(false)
  })

  test('sin Host con Origin presente → rechazado (no acreditado)', () => {
    expect(isSameOrigin(new Headers({ origin: 'http://localhost:3000' }))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// Allowlist opcional NEXT_PUBLIC_SITE_URL (tarea
// origin-allowlist-env del ROADMAP): despliegues tras proxies
// que reescriben el Host.
// ─────────────────────────────────────────────────────────────

describe('isSameOrigin — allowlist NEXT_PUBLIC_SITE_URL (origin-allowlist-env)', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL
  const setSiteUrl = (value: string | undefined) => {
    if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = value
  }
  afterEach(() => setSiteUrl(original))

  test('sin la variable: Host reescrito sigue rechazado (comportamiento previo intacto)', () => {
    setSiteUrl(undefined)
    expect(
      isSameOrigin(new Headers({ origin: 'https://area.example', host: 'interno.local:3000' }))
    ).toBe(false)
  })

  test('sin la variable: sin Host con Origin → rechazado (igual que antes)', () => {
    setSiteUrl(undefined)
    expect(isSameOrigin(new Headers({ origin: 'https://area.example' }))).toBe(false)
  })

  test('con la variable: Origin del sitio público se acredita aunque el Host difiera', () => {
    setSiteUrl('https://area.example')
    expect(
      isSameOrigin(new Headers({ origin: 'https://area.example', host: 'interno.local:3000' }))
    ).toBe(true)
  })

  test('con la variable: Origin del sitio se acredita incluso sin Host', () => {
    setSiteUrl('https://area.example')
    expect(isSameOrigin(new Headers({ origin: 'https://area.example' }))).toBe(true)
  })

  test('con la variable: Origin ajeno sigue rechazado', () => {
    setSiteUrl('https://area.example')
    expect(
      isSameOrigin(new Headers({ origin: 'https://evil.example', host: 'area.example' }))
    ).toBe(false)
  })

  test('con la variable: puerto distinto del sitio declarado → rechazado (host[:puerto])', () => {
    setSiteUrl('https://area.example')
    expect(
      isSameOrigin(new Headers({ origin: 'https://area.example:8443', host: 'area.example' }))
    ).toBe(false)
  })

  test('URL del sitio malformada → rechaza sin lanzar (no relaja nada)', () => {
    setSiteUrl('no-es-una-url')
    // Host distinto del Origin: solo la allowlist podría acreditarlo, y una
    // URL de sitio malformada no acredita a nadie.
    expect(
      isSameOrigin(new Headers({ origin: 'https://area.example', host: 'otro.host:8080' }))
    ).toBe(false)
    expect(isSameOrigin(new Headers({ origin: 'https://area.example' }))).toBe(false)
  })
})

describe('contentLengthExceeds — tope pre-parse (Ronda 12)', () => {
  test('Content-Length dentro del tope → false', () => {
    expect(contentLengthExceeds(new Headers({ 'content-length': '512' }), 1024)).toBe(false)
  })

  test('Content-Length sobre el tope → true', () => {
    expect(contentLengthExceeds(new Headers({ 'content-length': '2048' }), 1024)).toBe(true)
  })

  test('sin Content-Length (chunked) → false (se acota tras el parseo, documentado)', () => {
    expect(contentLengthExceeds(new Headers(), 1024)).toBe(false)
  })

  test('Content-Length no numérico → false sin lanzar', () => {
    expect(contentLengthExceeds(new Headers({ 'content-length': 'abc' }), 1024)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// readJsonBody — tope aplicado al STREAM (tarea cuerpo-chunked).
// Cierra la limitación que contentLengthExceeds documentaba: un
// cuerpo chunked sin Content-Length ya no se parsea íntegro.
// ─────────────────────────────────────────────────────────────

function requestWithStreamBody(chunks: string[], headers: Record<string, string> = {}): Request {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Request('http://localhost/api/test', {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers,
  } as RequestInit)
}

describe('readJsonBody — tope de stream (cuerpo-chunked)', () => {
  test('chunked dentro del tope → parsea el JSON completo', async () => {
    const req = requestWithStreamBody(['{"a":', '1}'])
    const res = await readJsonBody<{ a: number }>(req, 1024)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.body.a).toBe(1)
  })

  test('chunked que supera el tope → too-large SIN parsear todo', async () => {
    const big = 'x'.repeat(600)
    const req = requestWithStreamBody([big, big, big], { 'transfer-encoding': 'chunked' }) // 1800 B > 1024
    const res = await readJsonBody<unknown>(req, 1024)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('too-large')
  })

  test('Content-Length declarado sobre el tope → too-large vía rápida', async () => {
    const req = requestWithStreamBody(['{"a":1}'], { 'content-length': '99999' })
    const res = await readJsonBody<unknown>(req, 1024)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('too-large')
  })

  test('JSON inválido → invalid sin lanzar', async () => {
    const req = requestWithStreamBody(['{"a":'])
    const res = await readJsonBody<unknown>(req, 1024)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('invalid')
  })

  test('sin cuerpo → objeto vacío sin lanzar', async () => {
    const res = await readJsonBody<Record<string, never>>(new Request('http://localhost/api/test', { method: 'POST' }), 1024)
    expect(res.ok).toBe(true)
    if (res.ok) expect(Object.keys(res.body).length).toBe(0)
  })

  test('exactamente en el tope → permitido (el corte es al superarlo)', async () => {
    const payload = JSON.stringify({ a: 'y'.repeat(1014) }) // 1024 bytes exactos aprox.
    const req = requestWithStreamBody([payload])
    const res = await readJsonBody<{ a: string }>(req, payload.length)
    expect(res.ok).toBe(true)
  })
})

describe('adminTokenMatches — comparación de tiempo constante para /api/auth', () => {
  test('token correcto → true', () => {
    expect(adminTokenMatches('secreto-largo-correcto', 'secreto-largo-correcto')).toBe(true)
  })

  test('token incorrecto → false', () => {
    expect(adminTokenMatches('secreto-largo-incorrect', 'secreto-largo-correcto')).toBe(false)
  })

  test('longitud distinta → false sin filtrar por timing (compara igualmente)', () => {
    expect(adminTokenMatches('corto', 'secreto-largo-correcto')).toBe(false)
    expect(adminTokenMatches('', 'secreto-largo-correcto')).toBe(false)
  })
})
