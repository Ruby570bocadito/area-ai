import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http'
import { getLab, recordLabPort, setLabRound } from './store'
import { LabCampaignState, LabExchange, LabSession, SEGMENT_LEVEL, Signature, snippet } from './types'

// ─────────────────────────────────────────────────────────────
// LAB REAL — Runtime HTTP del ciber range.
//
// Un servidor HTTP real sobre 127.0.0.1 que sirve los servicios
// de cada nodo del escenario. Aplica política de red real
// (segmentación por niveles), controla sesiones, firewall,
// aislamientos y parches, clasifica firmas en el tráfico y
// escribe un diario de intercambios 100% real que consume el
// SIEM para las detecciones.
// ─────────────────────────────────────────────────────────────

const JOURNAL_CAP = 500

/** Revisión del protocolo del lab: si cambia, el servidor en memoria se reinicia solo */
const LAB_REV = 2

const g = globalThis as unknown as {
  __areaLabServer?: Server
  __areaLabPort?: number
  __areaLabStarting?: Promise<number>
}

export function labPort(): number {
  // Validación de rango (hallazgo Ronda 12 de bugs): `Number()` puro
  // aceptaba NaN ("LAB_PORT=abc"), 0, negativos y puertos > 65535 —
  // cualquier valor inválido lanzaba una excepción dentro del camino del
  // motor (server.listen) en la primera campaña. Valor inválido → defecto.
  const n = Number(process.env.LAB_PORT || 4403)
  if (!Number.isInteger(n) || n < 1 || n > 65535) return 4403
  return n
}

/** Arranca el servidor HTTP del laboratorio si no está ya corriendo (o si cambió la revisión). Devuelve el puerto. */
export async function ensureLabServer(): Promise<number> {
  if (g.__areaLabServer && g.__areaLabPort) {
    // Comprobación de revisión: un servidor antiguo en memoria se sustituye
    try {
      const res = await fetch(`http://127.0.0.1:${g.__areaLabPort}/lab-health`, { signal: AbortSignal.timeout(1500), cache: 'no-store' })
      const data = (await res.json()) as { rev?: number }
      if (data?.rev === LAB_REV) return g.__areaLabPort
    } catch { /* servidor zombi: se recrea */ }
    try {
      g.__areaLabServer.close()
    } catch { /* noop */ }
    g.__areaLabServer = undefined
    g.__areaLabPort = undefined
  }
  if (g.__areaLabStarting) return g.__areaLabStarting

  const start = async (): Promise<number> => {
    const base = labPort()
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 10; attempt++) {
      const port = base + attempt
      try {
        await listen(g.__areaLabServer ?? createHandler(), port)
        g.__areaLabPort = port
        recordLabPort(port)
        return port
      } catch (err) {
        lastErr = err
        g.__areaLabServer = undefined // probar a crear uno nuevo en el siguiente puerto
      }
    }
    throw lastErr ?? new Error('No se pudo arrancar el laboratorio')
  }

  g.__areaLabStarting = start().finally(() => {
    g.__areaLabStarting = undefined
  })
  return g.__areaLabStarting
}

function createHandler(): Server {
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      try {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'internal' }))
      } catch { /* noop */ }
    })
  })
  g.__areaLabServer = server
  return server
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.close()
      reject(err)
    }
    server.once('error', onError)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError)
      resolve()
    })
  })
}

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    server: 'area-lab/1.0',
    ...extraHeaders,
  })
  res.end(payload)
  return { body: payload, bytes: Buffer.byteLength(payload) }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 65536) req.destroy()
    })
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(data))
  })
}

function failBody(message: string) {
  return { ok: false, error: message }
}

function synthRecords(table: string, count: number): unknown[] {
  const names = ['ana.garcia', 'luis.martín', 'sofia.ruiz', 'marc.puig', 'elena.sáez', 'pablo.ortega', 'lucia.herrera', 'david.molina']
  const rows: unknown[] = []
  for (let i = 0; i < count; i++) {
    const n = names[i % names.length]
    rows.push(
      table.toLowerCase().includes('tarjeta') || table.toLowerCase().includes('pedido')
        ? { id: 1000 + i, cliente: `${n}@mail.com`, token: `tok_${(i + 7) * 8153}_${table.slice(0, 3)}`, importe: Math.round((Math.sin(i * 3.7) + 1.4) * 4120) / 100, moneda: 'EUR' }
        : { id: 100 + i, usuario: n, email: `${n}@mail.com`, ultimo_acceso: new Date(Date.now() - i * 3600_000).toISOString() }
    )
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
// Clasificación de firmas sobre el tráfico real
// ─────────────────────────────────────────────────────────────

function classify(lab: LabCampaignState, nodeId: string, method: string, path: string, body: string, resBytes: number): Signature | undefined {
  const lowerPath = path.toLowerCase()
  if (lowerPath.includes('..')) return 'PATH_TRAVERSAL'
  if (lowerPath.includes('/ipc$') || lowerPath.includes('/smb') || lowerPath.includes('/wmi')) return 'LATERAL_SMB'
  if ((method === 'POST' && lowerPath.endsWith('/login')) && (body.includes("'") || body.includes('--'))) return 'SQLI'
  if (lowerPath.endsWith('/auth') && /[0-9a-f]{32}/i.test(body)) return 'PASS_THE_HASH'
  if (lowerPath.includes('/api/exec') && /(cmd=|exec=|payload)/i.test(body)) return 'RCE_PAYLOAD'
  if (resBytes > 8000) return 'DATA_EXFIL'

  // Enumeración BOLA: varios ids distintos del mismo recurso
  const idMatch = lowerPath.match(/\/(api\/)?([a-z_]+)\/(\d+)$/)
  if (idMatch) {
    const ids = new Set(
      lab.journal
        .filter((e) => e.nodeId === nodeId && new RegExp(`/${idMatch[2]}/\\d+$`).test(e.path.toLowerCase()))
        .map((e) => e.path)
    )
    ids.add(lowerPath)
    if (ids.size >= 4) return 'BOLA_ENUM'
  }

  // Escaneo: >= 4 rutas distintas contra el mismo nodo en < 5 s
  const now = Date.now()
  const recent = lab.journal.filter((e) => e.nodeId === nodeId && now - new Date(e.at).getTime() < 5000)
  const distinctPaths = new Set(recent.map((e) => e.path))
  distinctPaths.add(path)
  if (distinctPaths.size >= 4) return 'PORT_SCAN'

  // Fuerza bruta: >= 3 fallos de login/auth recientes
  const recentFails = lab.journal.filter(
    (e) => e.nodeId === nodeId && e.status >= 400 && now - new Date(e.at).getTime() < 8000 &&
      (e.path.toLowerCase().endsWith('/login') || e.path.toLowerCase().endsWith('/auth'))
  ).length
  if (recentFails >= 2 && (lowerPath.endsWith('/login') || lowerPath.endsWith('/auth'))) return 'BRUTE_FORCE'

  const benign = ['/', '/health', '/version', '/robots.txt']
  if (!benign.includes(path)) return 'UNUSUAL_PATH'
  return undefined
}

// ─────────────────────────────────────────────────────────────
// Política de red — real: sin sesión válida no hay ruta
// ─────────────────────────────────────────────────────────────

function sessionFromReq(lab: LabCampaignState, req: IncomingMessage): LabSession | undefined {
  const sid = req.headers['x-lab-session']
  if (typeof sid !== 'string' || !sid) return undefined
  const s = lab.sessions.get(sid)
  return s && !s.revoked ? s : undefined
}

function isSessionBlocked(lab: LabCampaignState, session?: LabSession): boolean {
  if (!session) return false
  return lab.firewall.some((f) => f.blockSessionId === session.id)
}

function isNodeBlocked(lab: LabCampaignState, nodeId: string): boolean {
  return lab.firewall.some((f) => f.blockNodeId === nodeId)
}

/** ¿Es alcanzable el nodo destino con esta sesión? */
function routeAllowed(lab: LabCampaignState, nodeId: string, session?: LabSession): boolean {
  const node = lab.nodes.get(nodeId)
  if (!node) return false
  const targetLevel = SEGMENT_LEVEL[node.segment] ?? 2
  if (!session) return targetLevel <= 1 // externo solo alcanza la DMZ
  const home = lab.nodes.get(session.homeNodeId)
  const homeLevel = home ? SEGMENT_LEVEL[home.segment] ?? 0 : 0
  return homeLevel >= targetLevel - 1
}

function isSoc(req: IncomingMessage): boolean {
  return req.headers['x-lab-operator'] === 'soc'
}

// ─────────────────────────────────────────────────────────────
// Manejador principal
// ─────────────────────────────────────────────────────────────

async function handle(req: IncomingMessage, res: ServerResponse) {
  const started = Date.now()
  const url = new URL(req.url ?? '/', `http://127.0.0.1`)
  const parts = url.pathname.split('/').filter(Boolean) // ['lab', campaignId, nodeId, ...rest]

  let body = ''
  if (req.method === 'POST' || req.method === 'PUT') body = await readBody(req)

  const finish = (lab: LabCampaignState | undefined, nodeId: string, status: number, payload: string, bytes: number, signature?: Signature) => {
    if (lab && nodeId) {
      const exchange: LabExchange = {
        id: ++lab.seq,
        at: new Date().toISOString(),
        round: lab.round,
        nodeId,
        method: req.method ?? 'GET',
        path: url.pathname,
        status,
        ms: Date.now() - started,
        sessionId: sessionFromReq(lab, req)?.id,
        team: isSoc(req) ? 'BLUE' : 'RED',
        signature,
        reqSnippet: snippet(body || url.search.slice(1), 80),
        resSnippet: snippet(payload, 110),
        bytes,
      }
      lab.journal.push(exchange)
      if (lab.journal.length > JOURNAL_CAP) lab.journal.shift()
    }
  }

  // Rutas de salud del propio runtime
  if (parts[0] === 'lab-health') {
    const b = json(res, 200, { ok: true, service: 'area-lab', rev: LAB_REV, ts: new Date().toISOString() })
    finish(undefined, '', 200, b.body, b.bytes)
    return
  }

  if (parts[0] !== 'lab' || parts.length < 3) {
    const b = json(res, 404, failBody('ruta del laboratorio no encontrada'))
    finish(undefined, '', 404, b.body, b.bytes)
    return
  }

  const campaignId = decodeURIComponent(parts[1])
  const nodeId = decodeURIComponent(parts[2])
  const rest = parts.length > 3 ? '/' + parts.slice(3).join('/') : '/'
  const lab = getLab(campaignId)

  // ── Servicio OSINT (fuentes públicas reales del escenario): pasivo, sin ruta de red
  if (nodeId === 'osint' && lab) {
    const started2 = Date.now()
    const intel = {
      ok: true,
      company: lab.company,
      subdominios: [...lab.nodes.values()].map((n) => ({ host: `${n.nodeId}.${lab.scenarioKey}.lab`, segment: n.segment, type: n.type, expuesto: (SEGMENT_LEVEL[n.segment] ?? 2) <= 1 })),
      tecnologias: [...lab.nodes.values()].filter((n) => (SEGMENT_LEVEL[n.segment] ?? 2) <= 1).map((n) => `${n.nodeId}: ${n.type.toLowerCase()}-srv/2.4`),
      notas: 'Datos derivados de fuentes públicas (DNS, certificados, repositorios). Sin contacto directo con la víctima.',
    }
    const payload = JSON.stringify(intel)
    const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), server: 'area-lab/1.0' }
    res.writeHead(200, headers)
    res.end(payload)
    const exchange: LabExchange = {
      id: ++lab.seq,
      at: new Date().toISOString(),
      round: lab.round,
      nodeId: 'osint',
      method: req.method ?? 'GET',
      path: url.pathname,
      status: 200,
      ms: Date.now() - started2,
      team: 'RED',
      reqSnippet: snippet(url.search.slice(1), 80),
      resSnippet: snippet(payload, 110),
      bytes: Buffer.byteLength(payload),
    }
    lab.journal.push(exchange)
    if (lab.journal.length > JOURNAL_CAP) lab.journal.shift()
    return
  }

  if (!lab) {
    const b = json(res, 404, failBody('laboratorio no activo para esta campaña'))
    finish(undefined, nodeId, 404, b.body, b.bytes)
    return
  }

  const node = lab.nodes.get(nodeId)
  if (!node) {
    const b = json(res, 404, failBody(`nodo ${nodeId} no existe en el escenario`))
    finish(lab, nodeId, 404, b.body, b.bytes)
    return
  }

  const session = sessionFromReq(lab, req)
  const soc = isSoc(req)

  // Firewall real
  if (isSessionBlocked(lab, session)) {
    const b = json(res, 403, failBody('sesión bloqueada por el firewall'))
    const sig = classify(lab, nodeId, req.method ?? 'GET', rest, body, b.bytes)
    finish(lab, nodeId, 403, b.body, b.bytes, sig)
    return
  }
  if (isNodeBlocked(lab, nodeId) && !soc) {
    const b = json(res, 403, failBody('tráfico denegado por regla de firewall'))
    const sig = classify(lab, nodeId, req.method ?? 'GET', rest, body, b.bytes)
    finish(lab, nodeId, 403, b.body, b.bytes, sig)
    return
  }

  // Aislamiento real (contención de BLUE)
  if (node.isolated && !soc) {
    const b = json(res, 503, failBody('host aislado por el SOC — sin conexión'))
    finish(lab, nodeId, 503, b.body, b.bytes)
    return
  }

  // Política de red real (el SOC opera su propia red, RED necesita ruta válida).
  // Excepciones realistas: el correo llega a cualquier host (vector de phishing)
  // y el SIEM solo acepta operadores del SOC (ya validado arriba).
  const mailVector = rest === '/phish'
  if (!soc && !mailVector && !routeAllowed(lab, nodeId, session)) {
    const b = json(res, 403, failBody(session ? `sin ruta desde ${session.homeNodeId} hacia ${node.segment}` : 'acceso externo no permitido a este segmento'))
    const sig = classify(lab, nodeId, req.method ?? 'GET', rest, body, b.bytes)
    finish(lab, nodeId, 403, b.body, b.bytes, sig)
    return
  }

  const openVuln = () => Object.entries(node.vulnerabilities).find(([, st]) => st === 'OPEN')
  const vulnByName = (needle: RegExp) =>
    Object.entries(node.vulnerabilities).find(([name, st]) => needle.test(name) && st === 'OPEN')

  const createSession = (privileges: LabSession['privileges'], team: 'RED' | 'BLUE', origin: string, agentKey?: string): LabSession => {
    const s: LabSession = {
      id: `s-${lab.seq + 1}-${Math.random().toString(36).slice(2, 8)}`,
      homeNodeId: nodeId,
      team,
      agentKey,
      privileges,
      createdRound: lab.round,
      createdAt: new Date().toISOString(),
      revoked: false,
      origin,
    }
    lab.sessions.set(s.id, s)
    if (team === 'RED') node.compromised = true
    return s
  }

  // ════════ Servicios por tipo de nodo ════════
  const method = (req.method ?? 'GET').toUpperCase()
  let out: { body: string; bytes: number } | null = null
  let status = 200
  let sig: Signature | undefined

  try {
    // ── SIEM (solo SOC o sesión BLUE) ──
    if (node.type === 'SIEM') {
      if (!soc) {
        status = 403
        out = json(res, status, failBody('el SIEM solo acepta operadores del SOC'))
      } else if (rest === '/rules' && method === 'POST') {
        let rule: { segment?: string; nodeId?: string; signature?: Signature } = {}
        try { rule = JSON.parse(body) } catch { /* noop */ }
        if (!rule.signature || (!rule.segment && !rule.nodeId)) {
          status = 400
          out = json(res, status, failBody('falta signature y segment/nodeId'))
        } else {
          lab.monitors.push({
            id: `m-${lab.monitors.length + 1}`,
            segment: rule.segment ?? '',
            nodeId: rule.nodeId,
            signature: rule.signature,
            deployedRound: lab.round,
            by: 'SOC',
          })
          status = 201
          out = json(res, status, { ok: true, deployed: rule, rules: lab.monitors.length })
        }
      } else if (rest === '/events' && method === 'GET') {
        const seg = url.searchParams.get('segment')
        const signature = url.searchParams.get('signature') as Signature | null
        const visible = lab.journal.filter((e) => {
          if (e.team !== 'RED') return false
          const n = lab.nodes.get(e.nodeId)
          if (!n) return false
          if (seg && n.segment !== seg) return false
          // Visibilidad explícita: regla desplegada que cubra el nodo/firma
          const ruleHit = lab.monitors.some(
            (m) => m.signature === e.signature && (m.nodeId === e.nodeId || (m.segment && m.segment === n.segment))
          )
          if (ruleHit && (!signature || signature === e.signature)) return true
          // Visibilidad de perímetro: controles de borde sobre firmas de borde
          const perimeterCtl = n.controls.some((c) => /IPS|WAF|Anti-DDoS|NetFlow|Monitorización pasiva/i.test(c))
          const borderSig = e.signature && ['PORT_SCAN', 'BRUTE_FORCE', 'SQLI', 'UNUSUAL_PATH'].includes(e.signature)
          if (perimeterCtl && borderSig && (!signature || signature === e.signature)) return true
          return false
        })
        status = 200
        out = json(res, status, { ok: true, segment: seg, count: visible.length, events: visible.slice(-40) })
      } else if (rest === '/hunt' && method === 'GET') {
        // Hunting forense: ve el diario completo de nodos con regla o de alta criticidad (auditoría)
        const visible = lab.journal.filter((e) => {
          if (e.team !== 'RED') return false
          const n = lab.nodes.get(e.nodeId)
          if (!n) return false
          return n.criticality >= 4 || lab.monitors.some((m) => m.nodeId === e.nodeId || (m.segment && m.segment === n.segment))
        })
        status = 200
        out = json(res, status, { ok: true, count: visible.length, events: visible.slice(-60) })
      } else {
        status = 200
        out = json(res, status, { ok: true, service: node.nodeId, rules: lab.monitors.length, journal: lab.journal.length })
      }
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Operaciones de administración (SOC): parche, aislar, firewall ──
    if (rest === '/admin/patch' && method === 'POST') {
      if (!soc) {
        status = 403
        out = json(res, status, failBody('operación reservada al SOC'))
      } else {
        let p: { vulnerability?: string } = {}
        try { p = JSON.parse(body) } catch { /* noop */ }
        const name = Object.keys(node.vulnerabilities).find((v) => p.vulnerability && v.toLowerCase() === p.vulnerability.toLowerCase())
        if (!name) {
          status = 404
          out = json(res, status, failBody('vulnerabilidad no encontrada en este nodo'))
        } else {
          node.vulnerabilities[name] = 'PATCHED'
          node.patchesApplied.push(name)
          status = 200
          out = json(res, status, { ok: true, patched: name, remaining: Object.values(node.vulnerabilities).filter((s) => s === 'OPEN').length })
        }
      }
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0)
      return
    }

    if (rest === '/admin/isolate' && method === 'POST') {
      if (!soc) {
        status = 403
        out = json(res, status, failBody('operación reservada al SOC'))
      } else {
        node.isolated = true
        for (const s of lab.sessions.values()) {
          if (s.homeNodeId === nodeId && s.team === 'RED') s.revoked = true
        }
        status = 200
        out = json(res, status, { ok: true, isolated: nodeId, sessionsRevoked: [...lab.sessions.values()].filter((s) => s.homeNodeId === nodeId && s.revoked).length })
      }
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0)
      return
    }

    if (rest === '/admin/firewall' && method === 'POST') {
      if (!soc) {
        status = 403
        out = json(res, status, failBody('operación reservada al SOC'))
      } else {
        let f: { blockSessionId?: string; blockNodeId?: string; reason?: string } = {}
        try { f = JSON.parse(body) } catch { /* noop */ }
        if (!f.blockSessionId && !f.blockNodeId) {
          status = 400
          out = json(res, status, failBody('falta blockSessionId o blockNodeId'))
        } else {
          lab.firewall.push({
            id: `fw-${lab.firewall.length + 1}`,
            blockSessionId: f.blockSessionId,
            blockNodeId: f.blockNodeId,
            reason: f.reason ?? 'bloqueo SOC',
            deployedRound: lab.round,
            by: 'SOC',
          })
          status = 201
          out = json(res, status, { ok: true, rule: f })
        }
      }
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0)
      return
    }

    // ── Operaciones de escalada local (requiere sesión RED en el nodo) ──
    if (rest === '/local/escalate' && method === 'POST') {
      if (!session || session.homeNodeId !== nodeId) {
        status = 403
        out = json(res, status, failBody('se requiere sesión local en este host'))
      } else if (session.privileges === 'SYSTEM') {
        status = 200
        out = json(res, status, { ok: true, privileges: 'SYSTEM', note: 'ya era SYSTEM' })
      } else if (openVuln()) {
        session.privileges = 'SYSTEM'
        status = 200
        out = json(res, status, { ok: true, privileges: 'SYSTEM', exploited: openVuln()?.[0] })
      } else {
        status = 403
        out = json(res, status, failBody('hardening efectivo: sin vulnerabilidades locales explotables'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Movimiento lateral (SMB/WMI contra el destino) ──
    if ((rest === '/ipc$' || rest === '/smb' || rest === '/wmi') && method === 'POST') {
      sig = 'LATERAL_SMB'
      const s = createSession('USER', 'RED', 'lateral', typeof req.headers['x-lab-agent'] === 'string' ? req.headers['x-lab-agent'] : undefined)
      status = 200
      out = json(res, status, { ok: true, session: s.id, privileges: s.privileges, home: nodeId, via: 'reutilización de sesión legítima' })
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Exfiltración de base de datos ──
    if (node.type === 'DB' && (rest.startsWith('/query') || rest.startsWith('/data/')) && method === 'GET') {
      const table = rest.startsWith('/data/') ? rest.slice('/data/'.length) : (url.searchParams.get('table') ?? 'usuarios')
      const needsAdmin = !vulnByName(/cuentas de servicio|privilegios|snapshots|row-level|acceso directo/i)
      if (!session || (needsAdmin && session.privileges === 'USER')) {
        status = 403
        out = json(res, status, failBody(needsAdmin ? 'permisos insuficientes: se requieren credenciales privilegiadas' : 'autenticación requerida'))
      } else {
        const rows = synthRecords(table, 46)
        status = 200
        out = json(res, status, { ok: true, table, rows, count: rows.length })
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      if (status === 200) {
        lab.exfiltrated.push({ table, bytes: out?.bytes ?? 0, at: new Date().toISOString() })
      }
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Autenticación Kerberos / AD ──
    if (rest === '/auth' && method === 'POST') {
      const ntlm = /"ntlm"\s*:\s*"([0-9a-f]{32})"/i.exec(body)?.[1]
      const ptHash = vulnByName(/contraseñas|delegación|gpo|tokens/i)
      if (ntlm && ptHash) {
        const s = createSession('ADMIN', 'RED', 'pass-the-hash', req.headers['x-lab-agent'] as string | undefined)
        status = 200
        out = json(res, status, { ok: true, ticket: `krbtgt/${nodeId}:${s.id}`, session: s.id, privileges: 'ADMIN' })
      } else if (ntlm && !ptHash) {
        status = 401
        out = json(res, status, failBody('hash rechazado: credenciales rotadas'))
      } else {
        status = 401
        out = json(res, status, failBody('credenciales inválidas'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    if (rest === '/users' && method === 'GET') {
      status = 200
      out = json(res, status, {
        ok: true,
        users: ['svc-backup', 'adm-legacy', 'sql-service', 'helpdesk', 'jdirrectivo'].map((u, i) => ({ user: u, admin: i < 2 })),
      })
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── VPN ──
    if (node.type === 'VPN' && rest === '/connect' && method === 'POST') {
      const mfaCtl = node.controls.some((c) => /MFA/i.test(c))
      const mfaVuln = vulnByName(/sin MFA|MFA/i)
      let parsed: { user?: string; otp?: string } = {}
      try { parsed = JSON.parse(body) } catch { /* noop */ }
      if (!parsed.user) {
        status = 400
        out = json(res, status, failBody('faltan credenciales'))
      } else if (mfaCtl && !parsed.otp && !mfaVuln) {
        status = 401
        out = json(res, status, failBody('MFA requerido'))
      } else {
        const s = createSession('USER', 'RED', 'vpn', req.headers['x-lab-agent'] as string | undefined)
        status = 200
        out = json(res, status, { ok: true, session: s.id, privileges: 'USER', home: nodeId, mfa: mfaVuln ? 'omitido (vulnerabilidad)' : 'válido' })
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Login web ──
    if (rest === '/login' && method === 'POST') {
      const sqli = vulnByName(/SQL|inyecc/i)
      let parsed: { u?: string; p?: string } = {}
      try { parsed = JSON.parse(body) } catch { /* noop */ }
      if (sqli && (parsed.u?.includes("'") || body.includes("'--"))) {
        const s = createSession('ADMIN', 'RED', 'exploit-sqli', req.headers['x-lab-agent'] as string | undefined)
        status = 200
        out = json(res, status, { ok: true, user: parsed.u ?? "admin'--", role: 'admin', session: s.id, privileges: 'ADMIN' })
      } else if (sqli && (parsed.u || parsed.p)) {
        status = 401
        out = json(res, status, failBody('credenciales inválidas (input sanitizado)'))
      } else if (parsed.u === 'admin' && parsed.p === 'admin' && vulnByName(/contrase|autologin|sin MFA/i)) {
        const s = createSession('USER', 'RED', 'credenciales por defecto', req.headers['x-lab-agent'] as string | undefined)
        status = 200
        out = json(res, status, { ok: true, user: 'admin', session: s.id, privileges: 'USER' })
      } else {
        status = 401
        out = json(res, status, failBody('credenciales inválidas'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── API con BOLA ──
    if (node.type === 'API' && /^\/api\/[a-z_]+\/\d+$/.test(rest) && method === 'GET') {
      const bola = vulnByName(/BOLA|IDOR|throttle/i)
      const bolaPatched = Object.keys(node.vulnerabilities).some((v) => /BOLA|IDOR/i.test(v) && node.vulnerabilities[v] === 'PATCHED')
      if (bola || (!bolaPatched && node.vulnerabilities['BOLA en /pedidos/{id}'] === 'OPEN')) {
        const id = Number(rest.split('/').pop())
        status = 200
        const rows = synthRecords('pedidos', 1).map((r) => ({ ...(r as object), id }))
        out = json(res, status, { ok: true, record: rows[0], note: 'acceso a objeto sin autorización (BOLA)' })
      } else {
        status = bolaPatched ? 403 : 404
        out = json(res, status, failBody(bolaPatched ? 'autorización de objeto activa (BOLA parcheado)' : 'recurso no encontrado'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── RCE en servidores de aplicación ──
    if (rest === '/api/exec' && method === 'POST') {
      const rce = vulnByName(/dependencias|runners|secretos|webhooks|clipboard|java/i)
      if (rce && /(cmd=|exec=|payload)/i.test(body)) {
        const s = createSession('ADMIN', 'RED', 'exploit-rce', req.headers['x-lab-agent'] as string | undefined)
        status = 200
        out = json(res, status, { ok: true, shell: true, session: s.id, privileges: 'ADMIN', via: rce[0] })
      } else if (rce) {
        status = 400
        out = json(res, status, failBody('payload no reconocido'))
      } else {
        status = 403
        out = json(res, status, failBody('endpoint endurecido'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Phishing sobre endpoints ──
    if (rest === '/phish' && method === 'POST') {
      const edr = node.controls.some((c) => /EDR/i.test(c))
      const vuln = openVuln()
      if (vuln && !edr) {
        const s = createSession('USER', 'RED', 'phish', req.headers['x-lab-agent'] as string | undefined)
        status = 200
        out = json(res, status, { ok: true, session: s.id, privileges: 'USER', via: vuln[0] })
      } else {
        status = 403
        out = json(res, status, failBody(edr ? 'payload bloqueado por EDR' : 'usuario reportó el correo (sin éxito)'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Telemetría OT ──
    if (node.type === 'OT' && rest === '/telemetry' && method === 'GET') {
      const openProto = vulnByName(/DNP3|telemetría|sin autenticar/i)
      if (openProto) {
        status = 200
        out = json(res, status, {
          ok: true,
          protocol: openProto[0],
          puntos: Array.from({ length: 24 }, (_, i) => ({ tag: `TAG-${i + 1}`, valor: Math.round(Math.sin(i) * 2200 + 380) / 10, unidad: 'V' })),
        })
      } else {
        status = 403
        out = json(res, status, failBody('telemetría autenticada (protocolo cifrado)'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Exfiltración de documentos (objetivo en nodos no-DB/OT) ──
    if (rest === '/documents' && method === 'GET') {
      if (!session) {
        status = 403
        out = json(res, status, failBody('autenticación requerida para listar documentos'))
      } else {
        const docs = Array.from({ length: 52 }, (_, i) => ({
          id: `DOC-${2400 + i}`,
          titulo: ['Plan de fase', 'Especificación técnica', 'Acta de reunión', 'Dossier de proyecto'][i % 4] + ` v${(i % 9) + 1}.${i % 5}`,
          clasificacion: i % 6 === 0 ? 'RESTRINGIDO' : 'INTERNO',
          propietario: ['ingeniería', 'operaciones', 'dirección'][i % 3],
          contenido: 'registro-sintetico-'.repeat(12) + i,
        }))
        status = 200
        out = json(res, status, { ok: true, total: docs.length, documentos: docs })
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      if (status === 200) {
        lab.exfiltrated.push({ table: 'documentos', bytes: out?.bytes ?? 0, at: new Date().toISOString() })
      }
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Backups ──
    if (node.type === 'BACKUP' && rest === '/backups' && method === 'GET') {
      const plain = vulnByName(/credenciales en script/i)
      if (session && (plain || session.privileges !== 'USER')) {
        status = 200
        out = json(res, status, {
          ok: true,
          copias: ['full-2026-09-20.img', 'incr-2026-09-24.img', 'full-2026-09-13.img'].map((f, i) => ({ file: f, sizeGb: 40 + i * 7, immutable: i < 2 })),
        })
      } else {
        status = 403
        out = json(res, status, failBody('se requieren credenciales de copia'))
      }
      sig = classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
      finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
      return
    }

    // ── Páginas generales ──
    if (rest === '/' && method === 'GET') {
      status = 200
      out = json(res, status, {
        ok: true,
        service: node.nodeId,
        type: node.type,
        segment: node.segment,
        title: `Bienvenido a ${node.nodeId}`,
        powered: node.vulnerabilities && Object.keys(node.vulnerabilities).length > 0 ? Object.keys(node.vulnerabilities)[0] : 'estándar',
      })
    } else if (rest === '/health') {
      status = 200
      out = json(res, status, { ok: true, uptime: Math.floor(process.uptime()) })
    } else if (rest === '/version') {
      status = 200
      out = json(res, status, { ok: true, service: node.nodeId, stack: `${node.type.toLowerCase()}-srv/2.4`, vulnerabilities: Object.entries(node.vulnerabilities).map(([n, s]) => ({ n, s })) })
    } else if (rest === '/robots.txt') {
      status = 200
      out = json(res, status, 'User-agent: *\nDisallow: /admin\nDisallow: /api', )
    } else {
      status = 404
      out = json(res, status, failBody(`recurso ${rest} no encontrado en ${nodeId}`))
    }
    sig = sig ?? classify(lab, nodeId, method, rest, body, out?.bytes ?? 0)
    finish(lab, nodeId, status, out?.body ?? '', out?.bytes ?? 0, sig)
  } catch (err) {
    status = 500
    const b = json(res, 500, failBody('error interno del servicio'))
    finish(lab, nodeId, status, b.body, b.bytes)
    console.error('[lab] handler error:', err)
  }
}

export function setRound(campaignId: string, round: number) {
  setLabRound(campaignId, round)
}
