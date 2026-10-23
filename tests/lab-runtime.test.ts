// ─────────────────────────────────────────────────────────────
// Tests del runtime del laboratorio real (src/lib/lab/*)
//
// Red de seguridad de la tarea ALTA tests-lab-runtime. Levanta el
// servidor HTTP REAL del lab (127.0.0.1) en un puerto libre efímero
// y fija el contrato operativo completo:
//
//   · labPort() — validación de rango (LAB_PORT inválido → 4403).
//   · Política de red por segmentos — la DMZ es alcanzable desde
//     fuera, el núcleo exige pie (sesión), OT exige núcleo.
//   · Sesiones — SQLI abre sesión ADMIN real, phishing abre USER
//     por el vector de correo, escalada local exige sesión en el
//     host, sesión inventada no da ruta.
//   · Firewall — bloqueo de sesión y de nodo, reservado al SOC.
//   · Parcheo y aislamiento — el parche cierra la vía de explotación
//     y el aislado revoca sesiones y deja el host en 503.
//   · Clasificación de firmas sobre tráfico REAL — SQLI, BRUTE_FORCE,
//     UNUSUAL_PATH, BOLA_ENUM, RCE_PAYLOAD, DATA_EXFIL, PASS_THE_HASH,
//     LATERAL_SMB, PORT_SCAN y PATH_TRAVERSAL.
//   · SIEM — solo SOC, reglas, correlación, consulta y caza.
//   · OSINT y diario — inteligencia pasiva, equipo y ronda por intercambio.
//
// Ejecutar: bun test tests/lab-runtime.test.ts
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createServer as createNetServer } from 'node:net'

import { ensureLabServer, labPort, setRound } from '../src/lib/lab/runtime'
import { bootLab, cleanupLab, getLab } from '../src/lib/lab/store'
import {
  blueBlockSession,
  blueHunt,
  blueIsolate,
  blueMonitor,
  bluePatch,
  blueQuerySiem,
  evaluateDetections,
  redEscalada,
  redIntrusion,
  redLateral,
  redObjetivo,
  redRecon,
} from '../src/lib/lab/ops'
import type { InfraNode } from '../src/lib/sim/types'
import type { LabSession } from '../src/lib/lab/types'

// ─────────────────────────────────────────────────────────────
// Escenario sintético de prueba
// ─────────────────────────────────────────────────────────────

const nodo = (id: string, type: string, segment: string, criticality: number, vulnerabilities: string[], controls: string[] = []): InfraNode => ({
  id,
  name: id,
  type,
  ip: '127.0.0.1',
  segment,
  criticality,
  vulnerabilities,
  controls,
})

const INFRA: InfraNode[] = [
  nodo('web', 'WEB', 'DMZ', 4, ['Inyección SQL en login']),
  nodo('wafweb', 'WEB', 'DMZ', 3, [], ['WAF perimetral']),
  nodo('api', 'API', 'DMZ', 3, ['BOLA en /pedidos/{id}']),
  nodo('db', 'DB', 'CORE', 5, ['Cuentas de servicio con privilegios excesivos']),
  nodo('ad', 'AD', 'AD', 4, ['Contraseñas débiles en cuentas de servicio']),
  nodo('endpoint', 'ENDPOINT', 'CORE', 2, ['Macro malicioso sin EDR']),
  nodo('siem', 'SIEM', 'CORE', 5, []),
  nodo('ot', 'OT', 'OT', 5, ['DNP3 sin autenticar']),
]

const CAMP = 'camp-lab'
const CAMP_SIG = 'camp-sig'
const CAMP_SIEM = 'camp-siem'

const SCENARIO = { key: 'lab-test', company: 'Entidad de Prueba' }

let PORT = 0
let webSession: LabSession | undefined

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = createNetServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const p = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => (p > 0 ? resolve(p) : reject(new Error('sin puerto libre'))))
    })
    srv.on('error', reject)
  })

/** Petición cruda con control de sesión y cabecera SOC */
const req = (camp: string, nodeId: string, path: string, opts: { method?: string; body?: string; session?: string; soc?: boolean } = {}) =>
  fetch(`http://127.0.0.1:${PORT}/lab/${camp}/${nodeId}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.session ? { 'x-lab-session': opts.session } : {}),
      ...(opts.soc ? { 'x-lab-operator': 'soc' } : {}),
    },
    body: opts.body,
  }).then(async (r) => ({ status: r.status, body: await r.text() }))

const last = (camp: string) => getLab(camp)!.journal.at(-1)!
const json = <T,>(s: string) => JSON.parse(s) as T

// ─────────────────────────────────────────────────────────────
// 1. Validación del puerto
// ─────────────────────────────────────────────────────────────

describe('puerto del laboratorio (labPort)', () => {
  const ORIGINAL = process.env.LAB_PORT

  test('valores inválidos caen al 4403 por defecto', () => {
    for (const invalido of ['abc', '0', '-5', '70000', '']) {
      process.env.LAB_PORT = invalido
      expect(labPort()).toBe(4403)
    }
  })

  test('un valor válido se respeta', () => {
    process.env.LAB_PORT = '4999'
    expect(labPort()).toBe(4999)
    process.env.LAB_PORT = ORIGINAL
  })
})

// ─────────────────────────────────────────────────────────────
// 2. Servidor efímero
// ─────────────────────────────────────────────────────────────

describe('servidor efímero en puerto libre', () => {
  beforeAll(async () => {
    PORT = await freePort()
    process.env.LAB_PORT = String(PORT)
    bootLab(CAMP, SCENARIO, { nodes: INFRA }, 1)
    const p = await ensureLabServer()
    expect(p).toBe(PORT)
  })

  test('el lab responde en el puerto libre elegido', async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/lab-health`)
    expect(r.status).toBe(200)
    const data = json<{ ok: boolean; rev: number; service: string }>(await r.text())
    expect(data.ok).toBe(true)
    expect(data.rev).toBe(2)
    expect(data.service).toBe('area-lab')
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Intrusión y sesiones
// ─────────────────────────────────────────────────────────────

describe('intrusión y sesiones reales', () => {
  test('la SQLI sobre el WEB abre una sesión ADMIN real (exploit-sqli)', async () => {
    const out = await redIntrusion(CAMP, INFRA[0], 'red-viper')
    expect(out.result).toBe('EXITO')
    expect(out.session).toBeDefined()
    expect(out.session?.privileges).toBe('ADMIN')
    webSession = out.session
    expect(getLab(CAMP)!.sessions.get(out.session!.id)?.origin).toBe('exploit-sqli')
    const e = last(CAMP)
    expect(e.path.endsWith('/login')).toBe(true)
    expect(e.status).toBe(200)
    expect(e.signature).toBe('SQLI')
    expect(e.team).toBe('RED')
  })

  test('la escalada local exige sesión en el host (no vale sesión de otro nodo)', async () => {
    const out = await redEscalada(CAMP, INFRA[5]) // endpoint, sin sesión propia
    expect(out.result).toBe('FALLO')
    expect(out.session).toBeUndefined()
    expect(last(CAMP).status).toBe(403)
  })

  test('el phishing alcanza un host del núcleo sin ruta (vector de correo)', async () => {
    const out = await redIntrusion(CAMP, INFRA[5], 'red-viper')
    expect(out.result).toBe('EXITO')
    expect(out.session?.privileges).toBe('USER')
    expect(getLab(CAMP)!.sessions.get(out.session!.id)?.origin).toBe('phish')
  })

  test('la escalada local con sesión propia escala a SYSTEM (vuln abierta)', async () => {
    const out = await redEscalada(CAMP, INFRA[5])
    expect(out.result).toBe('EXITO')
    expect(getLab(CAMP)!.sessions.get(out.session!.id)?.privileges).toBe('SYSTEM')
  })

  test('una sesión inventada no da acceso al núcleo', async () => {
    const r = await req(CAMP, 'db', '/', { session: 's-fake' })
    expect(r.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Política de red por segmentos
// ─────────────────────────────────────────────────────────────

describe('política de red por segmentos', () => {
  test('la DMZ es alcanzable desde el exterior', async () => {
    const r = await req(CAMP, 'web', '/')
    expect(r.status).toBe(200)
  })

  test('el núcleo está cerrado sin sesión', async () => {
    const r = await req(CAMP, 'db', '/')
    expect(r.status).toBe(403)
    expect(json<{ error: string }>(r.body).error).toContain('acceso externo')
  })

  test('con pie en la DMZ, el núcleo es alcanzable (y la BD sirve con vuln de servicio)', async () => {
    const r = await req(CAMP, 'db', '/data/clientes', { session: webSession?.id })
    expect(r.status).toBe(200)
    expect(json<{ count: number }>(r.body).count).toBe(46)
  })

  test('OT sigue inalcanzable desde la DMZ (nivel 3)', async () => {
    const r = await req(CAMP, 'ot', '/telemetry', { session: webSession?.id })
    expect(r.status).toBe(403)
    expect(json<{ error: string }>(r.body).error).toContain('sin ruta')
  })
})

// ─────────────────────────────────────────────────────────────
// 5. Movimiento lateral y objetivo
// ─────────────────────────────────────────────────────────────

describe('movimiento lateral y objetivo', () => {
  test('el lateral SMB establece sesión USER en el destino', async () => {
    const out = await redLateral(CAMP, INFRA[3]) // db
    expect(out.result).toBe('EXITO')
    expect(out.session?.homeNodeId).toBe('db')
    expect(out.session?.privileges).toBe('USER')
    expect(last(CAMP).signature).toBe('LATERAL_SMB')
  })

  test('con sesión en el núcleo, OT es alcanzable y sirve telemetría', async () => {
    const dbSession = [...getLab(CAMP)!.sessions.values()].find((s) => s.homeNodeId === 'db' && !s.revoked)
    const r = await req(CAMP, 'ot', '/telemetry', { session: dbSession?.id })
    expect(r.status).toBe(200)
    expect(json<{ puntos: unknown[] }>(r.body).puntos).toHaveLength(24)
  })
})

// ─────────────────────────────────────────────────────────────
// 6. Firewall real
// ─────────────────────────────────────────────────────────────

describe('firewall real', () => {
  test('las operaciones de administración están reservadas al SOC', async () => {
    const r = await req(CAMP, 'web', '/admin/patch', { method: 'POST', body: '{"vulnerability":"x"}' })
    expect(r.status).toBe(403)
    expect(json<{ error: string }>(r.body).error).toContain('SOC')
  })

  test('bloquear una sesión RED la deja en 403 para siempre', async () => {
    const out = await blueBlockSession(CAMP, webSession!.id, 'cortar canal de mando')
    expect(out.result).toBe('EXITO')
    const r = await req(CAMP, 'web', '/', { session: webSession?.id })
    expect(r.status).toBe(403)
    expect(json<{ error: string }>(r.body).error).toContain('sesión bloqueada')
  })

  test('el bloqueo de nodo deniega al agente pero no al SOC', async () => {
    const regla = await req(CAMP, 'web', '/admin/firewall', {
      method: 'POST',
      soc: true,
      body: JSON.stringify({ blockNodeId: 'api', reason: 'prueba' }),
    })
    expect(regla.status).toBe(201)
    const agente = await req(CAMP, 'api', '/')
    expect(agente.status).toBe(403)
    expect(json<{ error: string }>(agente.body).error).toContain('firewall')
    const soc = await req(CAMP, 'api', '/', { soc: true })
    expect(soc.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────
// 7. Parcheo
// ─────────────────────────────────────────────────────────────

describe('parcheo de vulnerabilidades', () => {
  test('el SOC parchea la vuln real y queda marcada PATCHED', async () => {
    const out = await bluePatch(CAMP, 'web', 'Inyección SQL en login')
    expect(out.result).toBe('EXITO')
    const nodo = getLab(CAMP)!.nodes.get('web')!
    expect(nodo.vulnerabilities['Inyección SQL en login']).toBe('PATCHED')
    expect(nodo.patchesApplied).toContain('Inyección SQL en login')
  })

  test('parchear una vuln inexistente falla', async () => {
    const out = await bluePatch(CAMP, 'web', 'Vulnerabilidad inventada')
    expect(out.result).toBe('FALLO')
  })

  test('tras el parche, la intrusión SQLI ya no abre sesión', async () => {
    const out = await redIntrusion(CAMP, INFRA[0], 'red-viper')
    expect(out.session).toBeUndefined()
    expect(out.result).not.toBe('EXITO')
    expect(last(CAMP).status).toBe(401) // input sanitizado
  })
})

// ─────────────────────────────────────────────────────────────
// 8. Aislamiento
// ─────────────────────────────────────────────────────────────

describe('aislamiento de host comprometido', () => {
  test('aislar revoca las sesiones RED del host', async () => {
    const endpointSessions = [...getLab(CAMP)!.sessions.values()].filter((s) => s.homeNodeId === 'endpoint')
    expect(endpointSessions.length).toBeGreaterThan(0)
    const out = await blueIsolate(CAMP, 'endpoint')
    expect(out.result).toBe('EXITO')
    for (const s of endpointSessions) {
      expect(getLab(CAMP)!.sessions.get(s.id)?.revoked).toBe(true)
    }
  })

  test('el host aislado responde 503 al agente y 200 al SOC', async () => {
    const agente = await req(CAMP, 'endpoint', '/')
    expect(agente.status).toBe(503)
    const soc = await req(CAMP, 'endpoint', '/', { soc: true })
    expect(soc.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────
// 9. Clasificación de firmas sobre tráfico real
// ─────────────────────────────────────────────────────────────

describe('clasificación de firmas', () => {
  beforeAll(() => {
    bootLab(CAMP_SIG, SCENARIO, { nodes: INFRA }, 1)
  })

  test('SQLI en el login del WEB', async () => {
    const out = await redIntrusion(CAMP_SIG, INFRA[0], 'red-viper')
    expect(out.result).toBe('EXITO')
    expect(last(CAMP_SIG).signature).toBe('SQLI')
  })

  test('DATA_EXFIL al extraer documentos con sesión', async () => {
    const out = await redObjetivo(CAMP_SIG, INFRA[0])
    expect(out.result).toBe('EXITO')
    expect(last(CAMP_SIG).signature).toBe('DATA_EXFIL')
    expect(getLab(CAMP_SIG)!.exfiltrated.some((e) => e.table === 'documentos')).toBe(true)
  })

  test('BRUTE_FORCE tras fallos repetidos de login', async () => {
    for (let i = 0; i < 3; i++) {
      await req(CAMP_SIG, 'web', '/login', { method: 'POST', body: JSON.stringify({ u: 'admin', p: 'fallito' + i }) })
    }
    expect(last(CAMP_SIG).signature).toBe('BRUTE_FORCE')
    expect(last(CAMP_SIG).status).toBe(401)
  })

  test('UNUSUAL_PATH en rutas no benignas', async () => {
    const r = await req(CAMP_SIG, 'web', '/admin-secreto')
    expect(r.status).toBe(404)
    expect(last(CAMP_SIG).signature).toBe('UNUSUAL_PATH')
  })

  test('BOLA_ENUM al enumerar ids de la API', async () => {
    const out = await redIntrusion(CAMP_SIG, INFRA[2], 'red-viper')
    expect(out.result).toBe('EXITO')
    expect(last(CAMP_SIG).signature).toBe('BOLA_ENUM')
    expect(last(CAMP_SIG).path.endsWith('/api/pedidos/1045')).toBe(true)
  })

  test('RCE_PAYLOAD en /api/exec aunque el endpoint esté endurecido', async () => {
    const r = await req(CAMP_SIG, 'api', '/api/exec', { method: 'POST', body: 'exec=payload-test' })
    expect(r.status).toBe(403)
    expect(last(CAMP_SIG).signature).toBe('RCE_PAYLOAD')
  })

  test('PASS_THE_HASH sobre el AD con vuln de credenciales', async () => {
    const out = await redObjetivo(CAMP_SIG, INFRA[4])
    expect(out.result).toBe('EXITO')
    expect(last(CAMP_SIG).signature).toBe('PASS_THE_HASH')
    const admin = [...getLab(CAMP_SIG)!.sessions.values()].find((s) => s.origin === 'pass-the-hash')
    expect(admin?.privileges).toBe('ADMIN')
  })

  test('LATERAL_SMB al pivoting contra la BD', async () => {
    const out = await redLateral(CAMP_SIG, INFRA[3])
    expect(out.result).toBe('EXITO')
    expect(last(CAMP_SIG).signature).toBe('LATERAL_SMB')
  })

  test('PORT_SCAN al enumerar 4 rutas y detección por perímetro WAF sin reglas', async () => {
    const out = await redRecon(CAMP_SIG, INFRA[1]) // wafweb, sin vulns, con WAF
    expect(out.result).toBe('EXITO')
    const scan = last(CAMP_SIG)
    expect(scan.signature).toBe('PORT_SCAN')
    const detecciones = evaluateDetections(getLab(CAMP_SIG)!, [scan.id])
    expect(detecciones.length).toBe(1) // el WAF perimetral ve el escaneo sin regla del SIEM
    expect(detecciones[0].team).toBe('RED')
  })

  test('PATH_TRAVERSAL en intento de traversal codificado', async () => {
    // El estándar URL colapsa los `..` literales antes de que lleguen al
    // servidor; la variante que llega de verdad (y que clasifica) es la
    // codificada dentro de un segmento: ..%2f
    const r = await req(CAMP_SIG, 'web', '/downloads/..%2f..%2fetc%2fpasswd')
    expect(r.status).toBe(404)
    expect(last(CAMP_SIG).signature).toBe('PATH_TRAVERSAL')
  })
})

// ─────────────────────────────────────────────────────────────
// 10. SIEM, correlación y caza
// ─────────────────────────────────────────────────────────────

describe('SIEM, correlación y caza', () => {
  beforeAll(() => {
    bootLab(CAMP_SIEM, SCENARIO, { nodes: INFRA }, 1)
  })

  test('el SIEM solo acepta operadores del SOC', async () => {
    const agente = await req(CAMP_SIEM, 'siem', '/')
    expect(agente.status).toBe(403)
    const soc = await req(CAMP_SIEM, 'siem', '/', { soc: true })
    expect(soc.status).toBe(200)
  })

  test('desplegar una regla de monitorización real', async () => {
    const out = await blueMonitor(CAMP_SIEM, { segment: 'DMZ', signature: 'SQLI', by: 'blue-oracle' })
    expect(out.result).toBe('EXITO')
    expect(getLab(CAMP_SIEM)!.monitors).toHaveLength(1)
    expect(getLab(CAMP_SIEM)!.monitors[0].deployedRound).toBe(1)
  })

  test('la correlación detecta el tráfico real cubierto por la regla', async () => {
    const antes = getLab(CAMP_SIEM)!.journal.length
    await redIntrusion(CAMP_SIEM, INFRA[0], 'red-viper')
    const nuevos = getLab(CAMP_SIEM)!.journal.slice(antes).map((e) => e.id)
    const detecciones = evaluateDetections(getLab(CAMP_SIEM)!, nuevos)
    expect(detecciones.length).toBe(1)
    expect(detecciones[0].signature).toBe('SQLI')
    expect(detecciones.every((e) => e.team === 'RED')).toBe(true)
  })

  test('consulta al SIEM por segmento y firma', async () => {
    const out = await blueQuerySiem(CAMP_SIEM, 'DMZ', 'SQLI')
    expect(out.hits.length).toBeGreaterThanOrEqual(1)
  })

  test('la caza forense ve los nodos de alta criticidad', async () => {
    const out = await blueHunt(CAMP_SIEM, 'artefactos de prueba')
    expect(out.hits.length).toBeGreaterThanOrEqual(1) // web tiene criticidad 4
  })

  test('la evaluación de detecciones ignora el tráfico BLUE', () => {
    const lab = getLab(CAMP_SIEM)!
    const todas = evaluateDetections(lab, lab.journal.map((e) => e.id))
    expect(todas.every((e) => e.team === 'RED')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// 11. OSINT y diario
// ─────────────────────────────────────────────────────────────

describe('OSINT y diario del laboratorio', () => {
  test('el servicio OSINT pasivo devuelve inteligencia del escenario', async () => {
    const r = await req(CAMP_SIG, 'osint', '/?q=web')
    expect(r.status).toBe(200)
    const data = json<{ company: string; subdominios: unknown[]; notas: string }>(r.body)
    expect(data.company).toBe('Entidad de Prueba')
    expect(data.subdominios).toHaveLength(INFRA.length)
    expect(last(CAMP_SIG).nodeId).toBe('osint')
  })

  test('el diario registra equipo RED y la ronda vigente', async () => {
    setRound(CAMP_SIG, 7)
    await req(CAMP_SIG, 'web', '/health')
    expect(last(CAMP_SIG).team).toBe('RED')
    expect(last(CAMP_SIG).round).toBe(7)
  })

  test('las operaciones SOC quedan como equipo BLUE en el diario', async () => {
    const out = await bluePatch(CAMP_SIG, 'web', 'Inyección SQL en login')
    expect(out.result).toBe('EXITO')
    expect(last(CAMP_SIG).team).toBe('BLUE')
  })

  afterAll(() => {
    cleanupLab(CAMP)
    cleanupLab(CAMP_SIG)
    cleanupLab(CAMP_SIEM)
  })
})
