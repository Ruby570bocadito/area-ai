// ─────────────────────────────────────────────────────────────
// Superficie de mutaciones — cierre estructural del patrón
// «enumeración manual falla» (tarea test-superficie-mutaciones
// del ROADMAP; re-confirma HD3 de la Ronda 12).
//
// El test NO lleva una lista a mano de endpoints: DESCUBRE por
// directorio todos los route handlers de src/app/api/ que exporten
// POST/PUT/PATCH y exige en CADA uno, comportándose contra el
// handler real, los tres controles del orden canónico
// (documentado en src/lib/net/access.ts):
//
//   1. 403 same-origin PRIMERO (cross-origin ni siquiera consume cubo).
//   2. Rate limit del bucket `admin:` ANTES del token: una ráfaga sin
//      credenciales produce 401 hasta agotar el cubo y termina en 429
//      — si el token se comparara antes, la ráfaga daría 401 infinitos
//      (oráculo de fuerza bruta de ADMIN_TOKEN, el hueco que cerró
//      endurecimiento-hd en /api/campaigns).
//   3. El 429 se impone también con token VÁLIDO (mismo cubo).
//
// Una mutación futura SIN controles rompe esta suite en cuanto se
// añada su fichero route.ts, sin tocar el test.
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Entorno ANTES de importar los handlers: el token activa las barreras
// (sin él, el modo local abierto R4 las saltaría) y TRUST_PROXY permite
// aislar el bucket `admin:` de cada mutación vía X-Forwarded-For.
// DATABASE_URL de reserva para entornos sin .env (CI): la importación de
// los handlers instancia el cliente Prisma aunque el test nunca consulte.
process.env.ADMIN_TOKEN ??= 'token-superficie-mutaciones'
process.env.TRUST_PROXY ??= '1'
process.env.DATABASE_URL ??= 'file:' + resolve(import.meta.dir, '../.agent-tmp/superficie.db')

const TOKEN = process.env.ADMIN_TOKEN!
const API_DIR = resolve(import.meta.dir, '../src/app/api')

// bun test ejecuta todos los ficheros en un mismo proceso: restaurar el
// entorno al terminar para no romper los tests de modo abierto (R4) de los
// ficheros que corran después de este.
const __envOriginal: Record<string, string | undefined> = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  TRUST_PROXY: process.env.TRUST_PROXY,
  DATABASE_URL: process.env.DATABASE_URL,
}
afterAll(() => {
  for (const [k, v] of Object.entries(__envOriginal)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

type Mutation = {
  route: string
  method: string
  handler: (req: Request) => Promise<Response>
}

function discoverRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...discoverRouteFiles(p))
    else if (entry.name === 'route.ts') out.push(p)
  }
  return out
}

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH'] as const

const mutations: Mutation[] = []
// DELETE descubiertos: solo se admite la exención documentada (logout).
const deletions: { route: string; exempt: boolean }[] = []
// Logout (DELETE /api/auth): solo expira la cookie del cliente; sin estado
// de app que mutar y con una cookie SameSite=Strict que nunca viaja
// cross-site. Exención consciente — cualquier DELETE futuro romperá el
// test de cobertura de abajo hasta que se justifique aquí.
const EXEMPT = new Set([relative(API_DIR, join(API_DIR, 'auth', 'route.ts'))])

for (const file of discoverRouteFiles(API_DIR)) {
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>
  for (const method of MUTATION_METHODS) {
    const handler = mod[method]
    if (typeof handler === 'function') {
      mutations.push({
        route: relative(API_DIR, file),
        method,
        handler: handler as Mutation['handler'],
      })
    }
  }
  if (typeof mod.DELETE === 'function') {
    deletions.push({ route: relative(API_DIR, file), exempt: EXEMPT.has(relative(API_DIR, file)) })
  }
}

// Cubo por mutación: XFF distinto (TRUST_PROXY=1 → clientKey usa el primer
// salto de XFF), así la ráfaga de una no contamina la de la siguiente.
let xffCounter = 0
const xffForThisMutation = () => `10.53.${xffCounter++ % 254}.${(xffCounter * 7) % 254}`

const call = (m: Mutation, init: { origin?: string; token?: string; body?: string; xff: string }) => {
  const headers: Record<string, string> = {
    host: '127.0.0.1:3000',
    'x-forwarded-for': init.xff,
  }
  if (init.origin) headers.origin = init.origin
  if (init.token) headers['x-admin-token'] = init.token
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return m.handler(new Request('http://127.0.0.1:3000/api/x', { method: m.method, headers, body: init.body }))
}

// Cuerpos mínimos por ruta: ninguna prueba acreditada toca la BD (el 401/429
// llega antes del handler de negocio) y los topes de cuerpo (1-16 KB) están
// muy por encima de estos payloads.
const bodyFor = (route: string): string => {
  if (route.includes('settings')) return JSON.stringify({ baseUrl: 'https://api.example.com/v1', model: 'm' })
  if (route.includes('auth')) return JSON.stringify({ token: 'token-fuerza-bruta-erroneo' })
  return JSON.stringify({ enabled: false })
}

describe('superficie de mutaciones — descubrimiento estructural', () => {
  test('se descubren las 5 mutaciones conocidas', () => {
    expect(mutations.length).toBeGreaterThanOrEqual(5)
    const routes = mutations.map((m) => `${m.method} ${m.route}`).sort()
    for (const expected of ['POST autopilot/route.ts', 'POST auth/route.ts', 'POST campaigns/route.ts', 'POST models/route.ts', 'POST settings/route.ts']) {
      expect(routes).toContain(expected)
    }
  })

  test('solo existe DELETE en la exención documentada (logout de /api/auth)', () => {
    for (const d of deletions) {
      expect(`${d.route} exento=${d.exempt}`).toBe(`${d.route} exento=true`)
    }
  })

  test('cada mutación descubierta pasa los tres controles (las futuras, también)', () => {
    // El describe de abajo ya itera `mutations` — esta aserción ancla el
    // mínimo para que una reducción silenciosa de la superficie no pase.
    expect(mutations.length).toBeGreaterThanOrEqual(5)
  })
})

describe('superficie de mutaciones — los tres controles en cada handler real', () => {
  for (const m of mutations) {
    describe(`${m.method} ${m.route}`, () => {
      const xff = xffForThisMutation()

      test('1 · cross-origin con token válido → 403 (same-origin primero, sin consumir cubo)', async () => {
        const res = await call(m, { origin: 'http://evil.example', token: TOKEN, body: bodyFor(m.route), xff })
        expect(res.status).toBe(403)
      })

      test('2 · ráfaga sin credenciales: 401 hasta agotar el cubo y 429 al 31º (el cubo va ANTES del token)', async () => {
        const statuses: number[] = []
        for (let i = 0; i < 31; i++) {
          const res = await call(m, { body: bodyFor(m.route), xff })
          statuses.push(res.status)
        }
        expect(statuses[0]).toBe(401) // el token se exige (control de acreditación)
        expect(statuses[30]).toBe(429) // el cubo se agota: sin oráculo de fuerza bruta
      })

      test('3 · el 429 se impone también con token válido (mismo cubo)', async () => {
        const res = await call(m, { token: TOKEN, body: bodyFor(m.route), xff })
        expect(res.status).toBe(429)
      })
    })
  }
})
