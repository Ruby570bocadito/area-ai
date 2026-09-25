import { db } from '@/lib/db'
import { llmJson } from './llm'
import { ensureSeed } from './seed'
import { ensureProgressionMigration, levelForXp } from './progression'
import { knowledgeScore } from './knowledge-score'
import { normalizeLessonCategory, normalizeLessonTags } from './taxonomy'
import { RED_AGENTS, BLUE_AGENTS } from './roster'
import {
  PHASE_ORDER,
  PHASE_LABEL,
  type Phase,
  type EventDraft,
  type LessonDraft,
  type RedDecision,
  type KnowledgeRef,
  type Infrastructure,
  type InfraNode,
} from './types'
import { bootLab, cleanupLab, setLabRound } from '@/lib/lab/store'
import { ensureLabServer } from '@/lib/lab/runtime'
import {
  blueBlockSession,
  blueHunt,
  blueIsolate,
  blueMonitor,
  bluePatch,
  evaluateDetections,
  findSiemNode,
  isNodeReachable,
  redArmado,
  redEscalada,
  redIntrusion,
  redLateral,
  redObjetivo,
  redRecon,
  type OpOutcome,
} from '@/lib/lab/ops'
import { SIGNATURE_LABEL, type LabCampaignState, type Signature } from '@/lib/lab/types'
import { resolveCampaignOutcome } from '@/lib/victory'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

type AgentRow = Awaited<ReturnType<typeof db.agent.findMany>>[number]

const g = globalThis as unknown as { __aegisLLMAlive?: boolean | null }

/** Mapa agentKey → fases en las que toma la iniciativa (definido en el roster) */
const AGENT_PHASES = new Map<string, Phase[]>(
  [...RED_AGENTS, ...BLUE_AGENTS].map((a) => [a.key, a.phases])
)

/** Especialistas BLUE por tipo de operación defensiva */
const BLUE_OP_AGENTS: Record<string, string[]> = {
  BLOCK: ['blue-bastion', 'blue-citadel'],
  ISOLATE: ['blue-bastion'],
  PATCH: ['blue-bastion', 'blue-citadel'],
  MONITOR: ['blue-oracle', 'blue-argus'],
  HUNT: ['blue-sentinel'],
}

/** Elige el agente de la fase, rotando entre los que comparten fase para que todos participen */
function pickAgentForPhase<T extends { key: string }>(agents: T[], phase: Phase, round: number): T {
  const matches = agents.filter((a) => (AGENT_PHASES.get(a.key) ?? []).includes(phase))
  if (matches.length === 0) return agents[0]
  return matches[(round - 1) % matches.length]
}

function pickAgentForOp<T extends { key: string }>(agents: T[], op: string, phase: Phase, round: number): T {
  const prefs = BLUE_OP_AGENTS[op] ?? []
  for (const key of prefs) {
    const found = agents.find((a) => a.key === key)
    if (found) return found
  }
  return pickAgentForPhase(agents, phase, round)
}

// ─────────────────────────────────────────────────────────────
// Arranque de campaña
// ─────────────────────────────────────────────────────────────

export async function startCampaign(scenarioId?: string) {
  await ensureSeed()
  await ensureProgressionMigration()

  const running = await db.campaign.findFirst({ where: { status: 'RUNNING' } })
  if (running) {
    const err = new Error('Ya existe una campaña en curso') as Error & { code?: string }
    err.code = 'CAMPAIGN_RUNNING'
    throw err
  }

  const scenarios = await db.scenario.findMany()
  if (scenarios.length === 0) throw new Error('No hay escenarios disponibles')
  const scenario = scenarioId
    ? scenarios.find((s) => s.id === scenarioId) ?? rand(scenarios)
    : rand(scenarios)

  const campaign = await db.campaign.create({
    data: {
      scenarioId: scenario.id,
      maxRounds: PHASE_ORDER.length,
      status: 'RUNNING',
      phase: 'RECON',
    },
  })

  // Lanzar el bucle en segundo plano (no bloquea la respuesta HTTP)
  void runCampaign(campaign.id).catch(async (err) => {
    console.error('[engine] error fatal de campaña:', err)
    try {
      await db.campaign.update({ where: { id: campaign.id }, data: { status: 'ABORTED', endedAt: new Date() } })
    } catch { /* noop */ }
  })

  return campaign
}

// ─────────────────────────────────────────────────────────────
// Memoria institucional (conocimiento) por equipo
// ─────────────────────────────────────────────────────────────

async function loadMemory(team: 'RED' | 'BLUE'): Promise<KnowledgeRef[]> {
  const items = await db.knowledge.findMany({ where: { team } })
  items.sort((a, b) => knowledgeScore(b) - knowledgeScore(a))
  return items.slice(0, 8).map((k) => ({
    id: k.id,
    team: k.team,
    category: k.category,
    title: k.title,
    content: k.content,
    tags: k.tags,
    confidence: k.confidence,
    timesUsed: k.timesUsed,
    timesWorked: k.timesWorked,
  }))
}

const PHASE_TAGS: Record<Phase, string[]> = {
  RECON: ['recon', 'osint', 'deteccion', 'visibilidad', 'siem'],
  ARMADO: ['malware', 'weaponizacion', 'hardening', 'parcheo', 'planificacion'],
  INTRUSION: ['intrusion', 'explotacion', 'perimetro', 'mfa', 'waf', 'phishing'],
  ESCALADA: ['escalada', 'credenciales', 'privilegios', 'pam', 'laps'],
  LATERAL: ['lateral', 'segmentacion', 'ad', 'pivoting', 'ndr'],
  OBJETIVO: ['exfiltracion', 'ransomware', 'dlp', 'backup', 'contencion', 'c2'],
}

function pickPhaseKnowledge(mem: KnowledgeRef[], phase: Phase, n = 3): KnowledgeRef[] {
  const scored = mem.map((k) => {
    const tags = k.tags.toLowerCase().split(',').map((t) => t.trim())
    const overlap = tags.filter((t) => PHASE_TAGS[phase].some((p) => t.includes(p) || p.includes(t))).length
    return { k, s: overlap * 2 + knowledgeScore(k) }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, n).map((x) => x.k)
}

// ─────────────────────────────────────────────────────────────
// Bucle principal de campaña — con laboratorio REAL
// ─────────────────────────────────────────────────────────────

async function runCampaign(campaignId: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, include: { scenario: true } })
  if (!campaign) return

  const scenario = campaign.scenario
  const infra = JSON.parse(scenario.infrastructure) as Infrastructure
  const nodes: InfraNode[] = infra.nodes
  const redAgents = await db.agent.findMany({ where: { team: 'RED' } })
  const blueAgents = await db.agent.findMany({ where: { team: 'BLUE' } })

  // ── Laboratorio real: estado + servidor HTTP con los servicios del escenario
  cleanupLab(campaignId) // solo una campaña viva a la vez
  const lab = bootLab(campaignId, scenario, infra)
  let labPort: number | null = null
  try {
    labPort = await ensureLabServer()
  } catch (err) {
    console.error('[engine] no se pudo arrancar el laboratorio:', err)
  }

  let seq = 0
  let engineMode = 'LLM'

  const writeEvent = async (draft: EventDraft & { command?: string; evidence?: string }) => {
    await db.campaignEvent.create({
      data: {
        campaignId,
        seq: seq++,
        round: draft.round,
        phase: draft.phase,
        team: draft.team,
        agentKey: draft.agentKey,
        agentCodename: draft.agentCodename,
        action: draft.action,
        detail: draft.detail,
        result: draft.result,
        impact: draft.impact ?? 0,
        severity: draft.severity ?? 'INFO',
        targetNode: draft.targetNode,
        command: draft.command,
        evidence: draft.evidence,
      },
    })
  }

  // ── Sonda de disponibilidad LLM
  const probe = await llmJson<{ ok: boolean }>('Responde solo con JSON.', 'Confirma disponibilidad devolviendo {"ok": true}', 12000)
  const llmAlive = probe?.ok === true
  g.__aegisLLMAlive = llmAlive
  if (!llmAlive) engineMode = 'SIM'

  await db.campaign.update({ where: { id: campaignId }, data: { engineMode } })

  const siemNode = findSiemNode(lab)
  await writeEvent({
    round: 0,
    phase: 'RECON',
    team: 'SYSTEM',
    action: `Campaña ${scenario.codename} iniciada`,
    detail:
      `Escenario: ${scenario.company} (${scenario.industry}, dificultad ${scenario.difficulty}/5). ` +
      `Laboratorio REAL desplegado: ${nodes.length} servicios HTTP en 127.0.0.1:${labPort ?? '—'} con política de red por segmentos; ` +
      (siemNode ? `SIEM operativo en ${siemNode.id} sin reglas de correlación iniciales. ` : '') +
      `Los agentes ejecutarán comandos verificables contra el laboratorio. Objetivo RED: ${scenario.redObjective} Objetivo BLUE: ${scenario.blueObjective} Motor: ${engineMode === 'LLM' ? 'LLM activo' : 'simulación determinista (LLM no disponible)'}.`,
    severity: 'INFO',
  })

  let redProgress = 0
  let blueProgress = 0
  let redScore = 0
  let blueScore = 0
  const xpDelta = new Map<string, number>()
  const knowledgeUsed = new Map<string, { used: number; worked: number }>()

  const trackKnowledge = (ids: string[], worked: boolean) => {
    for (const id of ids) {
      const cur = knowledgeUsed.get(id) ?? { used: 0, worked: 0 }
      cur.used += 1
      if (worked) cur.worked += 1
      knowledgeUsed.set(id, cur)
    }
  }

  const recentEvents = async () => {
    const evs = await db.campaignEvent.findMany({
      where: { campaignId, team: { not: 'SYSTEM' } },
      orderBy: { seq: 'desc' },
      take: 6,
    })
    return evs.reverse().map((e) => `[R${e.round}/${e.phase}] ${e.team} ${e.agentCodename ?? ''}: ${e.action} → ${e.result ?? '—'} (impacto ${e.impact}). ${e.detail}`)
  }

  const maxRounds = campaign.maxRounds

  // ═══════════════════════════════════════════════════════════
  // Ejecutor de acciones RED — resuelve con el laboratorio real
  // ═══════════════════════════════════════════════════════════
  async function redAct(round: number, phase: Phase, agent: { key: string; codename: string; role: string; specialty: string; description: string; level: number }, excludeNodeId?: string) {
    const redMem = await loadMemory('RED')
    const redTurnK = pickPhaseKnowledge(redMem, phase)
    const redTurnIds = redTurnK.map((k) => k.id)

    const pool = nodes.filter((n) => n.id !== excludeNodeId)
    const usable = pool.length > 0 ? pool : nodes

    const ctx = `Escenario: ${scenario.codename} — ${scenario.company} (${scenario.industry}). Dificultad ${scenario.difficulty}/5.
Infraestructura:
${usable.map((n) => `- ${n.id} (${n.name}, tipo ${n.type}, segmento ${n.segment}, criticidad ${n.criticality}/5). Vulnerabilidades: ${n.vulnerabilities.join('; ') || 'sin datos'}. Controles: ${n.controls.join('; ') || 'básicos'}.`).join('\n')}
Ronda ${round} de ${maxRounds} — Fase: ${PHASE_LABEL[phase]}.
Últimos eventos:
${(await recentEvents()).join('\n') || '— sin eventos previos —'}`

    const redSystem = `Eres ${agent.codename}, ${agent.role} del RED TEAM en un ejercicio controlado (cyber range con servicios reales). Especialidad: ${agent.specialty}.
${agent.description}
Tu equipo persigue: ${scenario.redObjective}
Actúas en la fase ${PHASE_LABEL[phase]}: elige una técnica coherente con esa fase y un nodo objetivo.
Devuelve JSON estricto: {"action":"nombre corto de la técnica","detail":"1-2 frases en español","targetNode":"id del nodo","severity":"LOW|MEDIUM|HIGH|CRITICAL"}`

    let redDec: RedDecision | null = llmAlive
      ? await llmJson<RedDecision>(redSystem, `${ctx}
Memoria institucional RED (campañas previas):
${redMem.map((k) => `- [${k.category}] ${k.title}: ${k.content} (confianza ${(k.confidence * 100).toFixed(0)}%)`).join('\n') || '— primera campaña, sin memoria —'}

Elige el targetNode más lógico para la fase ${PHASE_LABEL[phase]}.`, 22000)
      : null
    if (!redDec || !redDec.action) redDec = fallbackRed(phase, usable, round)

    let target = usable.find((n) => n.id === redDec!.targetNode) ?? pickNodeForPhase(usable, phase)

    // Fijar objetivos alcanzables (el laboratorio aplica política de red real):
    // ESCALADA solo donde hay sesión; LATERAL/OBJETIVO dentro del alcance de red.
    if (phase === 'ESCALADA') {
      const sessionNodes = [...new Set([...lab.sessions.values()].filter((s) => s.team === 'RED' && !s.revoked).map((s) => s.homeNodeId))]
      const pool = usable.filter((n) => sessionNodes.includes(n.id))
      if (pool.length > 0 && !sessionNodes.includes(target.id)) target = pool[(round - 1) % pool.length]
    } else if (phase === 'LATERAL') {
      const reachable = usable.filter((n) => isNodeReachable(lab, n.id) && n.type !== 'SIEM')
      const pool = reachable.length > 0 ? reachable : usable.filter((n) => n.type !== 'SIEM')
      if (!isNodeReachable(lab, target.id) || target.type === 'SIEM') target = pool[round % pool.length]
    } else if (phase === 'OBJETIVO') {
      const typePriority: Record<string, number> = { DB: 3, OT: 2, AD: 2, BACKUP: 2 }
      const valuable = usable.filter((n) => n.criticality >= 4)
      const sorted = [...valuable].sort((a, b) => (typePriority[b.type] ?? 0) - (typePriority[a.type] ?? 0))
      const reachable = sorted.filter((n) => isNodeReachable(lab, n.id))
      const pool = reachable.length > 0 ? reachable : sorted.length > 0 ? sorted : usable
      if (!pool.some((n) => n.id === target.id)) target = pool[0] ?? target
    }

    // ── Ejecución REAL contra el laboratorio (nada de dados)
    const mark = lab.journal.length
    let outcome: OpOutcome
    switch (phase) {
      case 'RECON': outcome = await redRecon(campaignId, target); break
      case 'ARMADO': outcome = await redArmado(campaignId, target); break
      case 'INTRUSION': outcome = await redIntrusion(campaignId, target, agent.key); break
      case 'ESCALADA': outcome = await redEscalada(campaignId, target); break
      case 'LATERAL': outcome = await redLateral(campaignId, target); break
      case 'OBJETIVO': outcome = await redObjetivo(campaignId, target); break
    }

    const newExchanges = lab.journal.slice(mark)
    const signature = outcome.evidence.exchanges.length > 0
      ? newExchanges.find((e) => e.signature)?.signature
      : undefined

    // ── Impacto derivado del resultado real
    const sevImpact: Record<string, number> = { LOW: 4, MEDIUM: 7, HIGH: 11, CRITICAL: 16 }
    const defaultSev: Record<Phase, string> = { RECON: 'LOW', ARMADO: 'MEDIUM', INTRUSION: 'HIGH', ESCALADA: 'HIGH', LATERAL: 'HIGH', OBJETIVO: 'CRITICAL' }
    const severity = (redDec.severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(redDec.severity) ? redDec.severity : defaultSev[phase]) as string
    const critFactor = 0.7 + target.criticality / 10
    let impact = 0
    if (outcome.result === 'EXITO') impact = Math.round(sevImpact[severity] * critFactor * (1 - blueProgress / 160))
    else if (outcome.result === 'PARCIAL') impact = Math.round(sevImpact[severity] * 0.45)
    impact = clamp(impact, 0, 20)
    // Escala cerrada [0, 100]: acumulación RED acotada en memoria (simétrica a
    // blueProgress más abajo), para que el ganador, la narrativa, las lecciones
    // y la fila final compartan el mismo valor sin desbordamiento (Ronda 9 de
    // bugs: la evidencia "114/100" provenía de acumular aquí sin acotar).
    redProgress = clamp(redProgress + impact, 0, 100)
    redScore += impact + (outcome.result === 'FALLO' ? 1 : 0)
    trackKnowledge(redTurnIds, outcome.result !== 'FALLO')
    xpDelta.set(agent.key, (xpDelta.get(agent.key) ?? 0) + 6 + Math.round(impact / 3))

    await writeEvent({
      round,
      phase,
      team: 'RED',
      agentKey: agent.key,
      agentCodename: agent.codename,
      action: redDec.action,
      detail: redDec.detail,
      result: outcome.result,
      impact,
      severity,
      targetNode: target.id,
      command: outcome.command,
      evidence: JSON.stringify({
        exchanges: outcome.evidence.exchanges,
        artifacts: [...outcome.evidence.artifacts],
        detections: newExchanges.filter((e) => e.signature).map((e) => `${SIGNATURE_LABEL[e.signature as Signature]} → ${e.method} ${e.path} (${e.status})`),
      }),
    })

    await db.campaign.update({
      where: { id: campaignId },
      data: { round, phase, redProgress: clamp(redProgress, 0, 100), blueProgress: clamp(blueProgress, 0, 100), redScore, blueScore },
    })
    await sleep(500)

    return { target, outcome, newExchanges, impact }
  }

  // ═══════════════════════════════════════════════════════════
  // Ejecutor de acciones BLUE — detección y respuesta reales
  // ═══════════════════════════════════════════════════════════
  async function blueAct(
    round: number,
    phase: Phase,
    op: string,
    opts: { detections?: { nodeId: string; signature: Signature }[]; hypothesis?: string; patchNode?: string; patchVuln?: string; sessionToBlock?: string; isolateNode?: string; redNode?: string },
    forcedAgent?: AgentRow
  ) {
    const blueMem = await loadMemory('BLUE')
    const blueTurnK = pickPhaseKnowledge(blueMem, phase)
    const blueTurnIds = blueTurnK.map((k) => k.id)
    const agent = forcedAgent ?? pickAgentForOp(blueAgents, op, phase, round)

    let outcome: OpOutcome | null = null
    let verdict = 'ENDURECIDO'
    let actionName = ''
    let detail = ''
    let targetNode: string | undefined = opts.redNode

    if (op === 'BLOCK') {
      const sid = opts.sessionToBlock
      if (sid) {
        outcome = await blueBlockSession(campaignId, sid, `${agent.codename}: cortar canal de mando`)
        verdict = 'BLOQUEADO'
        targetNode = opts.redNode
      } else {
        op = 'MONITOR'
      }
    }
    if (op === 'ISOLATE') {
      const nodeId = opts.isolateNode
      if (nodeId) {
        outcome = await blueIsolate(campaignId, nodeId)
        verdict = 'CONTENIDO'
        targetNode = nodeId
      } else {
        op = 'PATCH'
      }
    }
    if (op === 'MONITOR' || op === 'HUNT') {
      // Sin SIEM en el escenario no hay correlación posible → endurecimiento directo
      if (!siemNode) {
        const { nodeId, vuln } = bestPatchTarget(lab, opts.redNode)
        if (nodeId && vuln) {
          op = 'PATCH'
          opts = { ...opts, patchNode: nodeId, patchVuln: vuln }
        }
      }
    }
    if (op === 'PATCH') {
      const nodeId = opts.patchNode
      const vuln = opts.patchVuln
      if (nodeId && vuln) {
        outcome = await bluePatch(campaignId, nodeId, vuln)
        verdict = 'ENDURECIDO'
        targetNode = nodeId
      } else {
        op = 'MONITOR'
      }
    }
    if (op === 'MONITOR') {
      const det = opts.detections?.[0]
      const signature = det?.signature ?? defaultSignatureFor(phase)
      const segment = det ? lab.nodes.get(det.nodeId)?.segment : segmentForPhase(phase)
      outcome = await blueMonitor(campaignId, { segment, nodeId: det?.nodeId, signature, by: agent.codename })
      const hits = det ? evaluateDetections(lab, lab.journal.filter((e) => e.nodeId === det.nodeId).map((e) => e.id)) : []
      verdict = hits.length > 0 ? 'DETECTADO' : 'ENDURECIDO'
      targetNode = det?.nodeId ?? siemNode?.id
    }
    if (op === 'HUNT') {
      const h = await blueHunt(campaignId, opts.hypothesis ?? 'artefactos de compromiso recientes')
      outcome = { result: h.hits.length > 0 ? 'EXITO' : 'FALLO', evidence: h.evidence, command: h.command, artifacts: [], bytes: 0 }
      verdict = h.hits.length > 0 ? 'DETECTADO' : 'IGNORADO'
      actionName = 'Threat hunting proactivo'
      detail = `Hipótesis: ${opts.hypothesis ?? 'artefactos de compromiso recientes'}. Resultado real del diario del laboratorio: ${h.hits.length} coincidencias.`
    }

    if (!outcome) {
      outcome = { result: 'FALLO', evidence: { exchanges: [], artifacts: [] }, command: '# operación no viable en el estado actual', artifacts: [], bytes: 0 }
      verdict = 'IGNORADO'
    }

    // Narrativa LLM opcional (la verdict/op SIEMPRE salen del laboratorio real)
    if (llmAlive) {
      const blueSystem = `Eres ${agent.codename}, ${agent.role} del BLUE TEAM (defensa) en un cyber range con servicios reales. Especialidad: ${agent.specialty}.
${agent.description}
Ya has ejecutado una operación REAL de tipo ${op} en el laboratorio. Redacta el parte: acción y detalle en español.
Devuelve JSON estricto: {"action":"nombre corto de la acción defensiva","detail":"1-2 frases en español citando la evidencia real"}`
      const narr = await llmJson<{ action: string; detail: string }>(
        blueSystem,
        `Operación ejecutada: ${outcome.command}
Veredicto real: ${verdict}. Evidencia: ${JSON.stringify(outcome.evidence).slice(0, 700)}
Contexto: fase ${PHASE_LABEL[phase]}, ronda ${round}.`,
        18000
      )
      if (narr?.action) actionName = narr.action
      if (narr?.detail) detail = narr.detail
    }
    if (!actionName) actionName = fallbackBlueName(op, verdict)
    if (!detail) detail = fallbackBlueDetail(op, outcome, verdict)

    const defGain: Record<string, number> = { BLOQUEADO: 10, CONTENIDO: 8, DETECTADO: 6, ENDURECIDO: 5, IGNORADO: 1 }
    const defImpact = defGain[verdict] ?? 1
    blueProgress = clamp(blueProgress + defImpact + 2, 0, 100)
    blueScore += defImpact * 2
    trackKnowledge(blueTurnIds, verdict === 'BLOQUEADO' || verdict === 'DETECTADO' || verdict === 'CONTENIDO')
    xpDelta.set(agent.key, (xpDelta.get(agent.key) ?? 0) + 5 + Math.round(defImpact / 2))

    await writeEvent({
      round,
      phase,
      team: 'BLUE',
      agentKey: agent.key,
      agentCodename: agent.codename,
      action: actionName,
      detail,
      result: verdict,
      impact: defImpact,
      severity: verdict === 'BLOQUEADO' || verdict === 'CONTENIDO' ? 'LOW' : verdict === 'IGNORADO' ? 'HIGH' : 'MEDIUM',
      targetNode,
      command: outcome.command,
      evidence: JSON.stringify({ exchanges: outcome.evidence.exchanges, artifacts: outcome.evidence.artifacts }),
    })

    await db.campaign.update({
      where: { id: campaignId },
      data: { round, phase, redProgress: clamp(redProgress, 0, 100), blueProgress: clamp(blueProgress, 0, 100), redScore, blueScore },
    })
    await sleep(500)
  }

  // ─────────────────────────────────────────────────────────
  // Bucle de rondas con CADENCIA DINÁMICA (no 1-1 estricto):
  // RED abre; si prospera puede encadenar; BLUE responde a
  // detecciones reales del SIEM y actúa de forma proactiva
  // cuando no hay señal. 2-4 acciones por ronda, orden variable.
  // ─────────────────────────────────────────────────────────
  for (let round = 1; round <= maxRounds; round++) {
    const phase = PHASE_ORDER[round - 1]
    setLabRound(campaignId, round)
    const redAgent = pickAgentForPhase(redAgents, phase, round)

    let blueActionsThisRound = 0

    // 1) Acción RED obligatoria
    const first = await redAct(round, phase, redAgent)
    let lastTarget = first.target
    let lastOutcome = first.outcome

    // Reacción inmediata de BLUE a detecciones reales
    const detectIds = first.newExchanges.map((e) => e.id)
    const detections = evaluateDetections(lab, detectIds)
    if (detections.length > 0) {
      const sessionToBlock = [...lab.sessions.values()].find((s) => s.team === 'RED' && !s.revoked && s.homeNodeId === lastTarget.id)?.id
      const detPayload = detections.map((d) => ({ nodeId: d.nodeId, signature: d.signature as Signature })).filter((x, i, arr) => arr.findIndex((y) => y.nodeId === x.nodeId && y.signature === x.signature) === i)
      const op = sessionToBlock && phase !== 'RECON' ? 'BLOCK' : 'MONITOR'
      await blueAct(round, phase, op, {
        detections: detPayload,
        sessionToBlock: op === 'BLOCK' ? sessionToBlock : undefined,
        redNode: lastTarget.id,
      })
      blueActionsThisRound++
    }

    // 2) RED encadena si prosperó (la ofensiva real aprovecha el momentum)
    const chainable = phase === 'INTRUSION' || phase === 'ESCALADA' || phase === 'LATERAL' || phase === 'OBJETIVO'
    if (chainable && lastOutcome.result === 'EXITO' && Math.random() < 0.4) {
      const second = await redAct(round, phase, redAgent, lastTarget.id)
      lastTarget = second.target
      lastOutcome = second.outcome
      const det2 = evaluateDetections(lab, second.newExchanges.map((e) => e.id))
      if (det2.length > 0) {
        const sessionToBlock = [...lab.sessions.values()].find((s) => s.team === 'RED' && !s.revoked && s.homeNodeId === lastTarget.id)?.id
        await blueAct(round, phase, sessionToBlock ? 'BLOCK' : 'MONITOR', {
          detections: det2.map((d) => ({ nodeId: d.nodeId, signature: d.signature as Signature })),
          sessionToBlock,
          redNode: lastTarget.id,
        })
        blueActionsThisRound++
      }
    }

    // 3) BLUE proactivo si no ha actuado todavía: hunting o endurecimiento
    if (blueActionsThisRound === 0) {
      const roll = Math.random()
      if (roll < 0.3) {
        await blueAct(round, phase, 'HUNT', { hypothesis: huntHypothesis(phase), redNode: lastTarget.id })
        blueActionsThisRound++
      } else if (roll < 0.85) {
        const { nodeId, vuln } = bestPatchTarget(lab, lastTarget.id)
        if (nodeId && vuln) {
          await blueAct(round, phase, 'PATCH', { patchNode: nodeId, patchVuln: vuln, redNode: lastTarget.id })
          blueActionsThisRound++
        } else {
          await blueAct(round, phase, 'MONITOR', { redNode: lastTarget.id })
          blueActionsThisRound++
        }
      }
    }

    // 4) Emergencia en OBJETIVO: si RED consiguió su golpe, BLUE reacciona siempre
    if (phase === 'OBJETIVO' && lastOutcome.result === 'EXITO') {
      const nodeState = lab.nodes.get(lastTarget.id)
      if (nodeState?.compromised && !nodeState.isolated) {
        await blueAct(round, phase, 'ISOLATE', { isolateNode: lastTarget.id, redNode: lastTarget.id })
        blueActionsThisRound++
      } else {
        const { nodeId, vuln } = bestPatchTarget(lab, lastTarget.id)
        if (nodeId && vuln) await blueAct(round, phase, 'PATCH', { patchNode: nodeId, patchVuln: vuln, redNode: lastTarget.id })
        else await blueAct(round, phase, 'MONITOR', { redNode: lastTarget.id })
        blueActionsThisRound++
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Cierre: ganador, narrativa, lecciones y evolución
  // ─────────────────────────────────────────────────────────
  // Resolución canónica: regla de victoria aplicada sobre el progreso acotado
  // (fuente única en src/lib/victory.ts, compartida con la UI; contrato fijado
  // en tests/victory.test.ts).
  const { winner } = resolveCampaignOutcome(redProgress, blueProgress)

  const allEvents = await db.campaignEvent.findMany({ where: { campaignId }, orderBy: { seq: 'asc' } })
  const compact = allEvents
    .filter((e) => e.team !== 'SYSTEM')
    .map((e) => `${e.team} ${e.agentCodename}: ${e.action} sobre ${e.targetNode ?? '—'} → ${e.result} (impacto ${e.impact}). ${e.detail}`)

  const lessonsSchema = `Devuelve JSON estricto:
{"narrative":"resumen de 3-4 frases de la campaña en español",
 "red":[{"category":"TACTICA|TECNICA|LECCION|VULNERABILIDAD","title":"título corto","content":"2-3 frases del aprendizaje concreto y accionable","tags":["tag1","tag2"],"confidence":0.0-1.0}],
 "blue":[...igual, aprendizajes defensivos...]}`
  const lessonsUser = `Campaña ${scenario.codename} sobre ${scenario.company}. Ganador: ${winner}. Progreso RED ${redProgress}/100, postura BLUE ${blueProgress}/100.
Todo se ejecutó contra un laboratorio real (intercambios HTTP verificados). Eventos:
${compact.join('\n')}

Extrae 2 lecciones por equipo: qué funcionó, qué falló y cómo aplicarlo la próxima campaña. Sé específico.`

  type LessonsOut = { narrative?: string; red?: LessonDraft[]; blue?: LessonDraft[] }
  let lessons: LessonsOut | null = llmAlive ? await llmJson<LessonsOut>(lessonsSchema, lessonsUser, 30000) : null
  if (!lessons || !Array.isArray(lessons.red) || !Array.isArray(lessons.blue)) {
    lessons = fallbackLessons(winner, redProgress, blueProgress, scenario.redObjective, scenario.blueObjective)
  }

  const narrative =
    (lessons.narrative ?? '').slice(0, 1200) ||
    `Campaña finalizada. ${winner === 'RED' ? 'El RED TEAM' : winner === 'BLUE' ? 'El BLUE TEAM' : 'Ninguno de los equipos'} prevaleció (RED ${redProgress}/100 vs BLUE ${blueProgress}/100). Ambos equipos archivan el aprendizaje para la siguiente campaña.`

  // Guardar lecciones
  const saveLessons = async (team: 'RED' | 'BLUE', arr: LessonDraft[]) => {
    for (const l of arr.slice(0, 3)) {
      if (!l?.title || !l?.content) continue
      await db.knowledge.create({
        data: {
          team,
          campaignId,
          category: normalizeLessonCategory(l.category),
          title: String(l.title).slice(0, 140),
          content: String(l.content).slice(0, 900),
          tags: normalizeLessonTags(l.tags),
          confidence: clamp(Number(l.confidence) || 0.55, 0.2, 0.95),
        },
      })
    }
  }
  await saveLessons('RED', lessons.red ?? [])
  await saveLessons('BLUE', lessons.blue ?? [])

  // Actualizar estadísticas de conocimiento usado (bucle de evolución)
  for (const [id, u] of knowledgeUsed) {
    const k = await db.knowledge.findUnique({ where: { id } })
    if (!k) continue
    const used = k.timesUsed + u.used
    const worked = k.timesWorked + u.worked
    const ratio = worked / Math.max(1, used)
    const confidence = clamp(0.3 + ratio * 0.6 + Math.min(1, used / 10) * 0.1, 0.2, 0.95)
    await db.knowledge.update({ where: { id }, data: { timesUsed: used, timesWorked: worked, confidence } })
  }

  // Actualizar agentes (XP con curva realista, nivel derivado, victorias)
  const allAgents = await db.agent.findMany()
  for (const a of allAgents) {
    const xp = a.xp + (xpDelta.get(a.key) ?? 0)
    const isWinner = (winner === 'RED' && a.team === 'RED') || (winner === 'BLUE' && a.team === 'BLUE')
    await db.agent.update({
      where: { id: a.id },
      data: {
        xp,
        level: levelForXp(xp),
        campaigns: a.campaigns + 1,
        victories: a.victories + (isWinner ? 1 : 0),
      },
    })
  }

  const totalExchanges = lab.journal.length
  await writeEvent({
    round: maxRounds,
    phase: 'OBJETIVO',
    team: 'SYSTEM',
    action: `Fin de la campaña — victoria: ${winner === 'RED' ? 'RED TEAM' : winner === 'BLUE' ? 'BLUE TEAM' : 'EMPATE'}`,
    detail: `${narrative} Telemetría real del laboratorio: ${totalExchanges} intercambios HTTP verificados, ${lab.sessions.size} sesiones creadas, ${lab.firewall.length} bloqueos y ${lab.exfiltrated.length} extracciones de datos. Lecciones archivadas: ${lessons.red?.length ?? 0} del RED, ${lessons.blue?.length ?? 0} del BLUE.`,
    severity: 'INFO',
  })

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'COMPLETED',
      winner,
      narrative,
      // Defensa en profundidad: la fila final respeta la escala cerrada aunque
      // un valor en memoria llegase desbordado (recomendación del reparto 19h31).
      redProgress: clamp(redProgress, 0, 100),
      blueProgress: clamp(blueProgress, 0, 100),
      redScore,
      blueScore,
      endedAt: new Date(),
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Ayudantes de decisión BLUE sobre estado real del lab
// ─────────────────────────────────────────────────────────────

function defaultSignatureFor(phase: Phase): Signature {
  switch (phase) {
    case 'RECON': return 'PORT_SCAN'
    case 'ARMADO': return 'UNUSUAL_PATH'
    case 'INTRUSION': return 'SQLI'
    case 'ESCALADA': return 'PASS_THE_HASH'
    case 'LATERAL': return 'LATERAL_SMB'
    case 'OBJETIVO': return 'DATA_EXFIL'
  }
}

function segmentForPhase(phase: Phase): string {
  switch (phase) {
    case 'RECON': return 'DMZ'
    case 'ARMADO': return 'DMZ'
    case 'INTRUSION': return 'DMZ'
    case 'ESCALADA': return 'CORE'
    case 'LATERAL': return 'CORE'
    case 'OBJETIVO': return 'CORE'
  }
}

function huntHypothesis(phase: Phase): string {
  switch (phase) {
    case 'RECON': return 'enumeración temprana de superficie'
    case 'ARMADO': return 'preparación de payload en endpoints'
    case 'INTRUSION': return 'acceso inicial anómalo en la DMZ'
    case 'ESCALADA': return 'abuso de credenciales privilegiadas'
    case 'LATERAL': return 'pivoting entre segmentos'
    case 'OBJETIVO': return 'exfiltración masiva de datos'
  }
}

/** Busca el mejor parche real: nodo comprometido o de mayor criticidad con vuln abierta */
function bestPatchTarget(lab: LabCampaignState, preferNodeId?: string): { nodeId?: string; vuln?: string } {
  const candidates: Array<{ nodeId: string; vuln: string; crit: number }> = []
  for (const n of lab.nodes.values()) {
    for (const [vuln, st] of Object.entries(n.vulnerabilities)) {
      if (st === 'OPEN') candidates.push({ nodeId: n.nodeId, vuln, crit: n.criticality + (n.compromised ? 10 : 0) })
    }
  }
  if (preferNodeId) {
    const preferred = candidates.filter((c) => c.nodeId === preferNodeId).sort((a, b) => b.crit - a.crit)[0]
    if (preferred) return { nodeId: preferred.nodeId, vuln: preferred.vuln }
  }
  const best = candidates.sort((a, b) => b.crit - a.crit)[0]
  return best ? { nodeId: best.nodeId, vuln: best.vuln } : {}
}

function fallbackBlueName(op: string, verdict: string): string {
  const names: Record<string, string> = {
    BLOCK: 'Bloqueo de sesión atacante',
    ISOLATE: 'Aislamiento del host comprometido',
    PATCH: 'Parcheo de vulnerabilidad explotada',
    MONITOR: 'Despliegue de regla de monitorización',
    HUNT: 'Threat hunting proactivo',
  }
  return names[op] ?? (verdict === 'IGNORADO' ? 'Barrido sin señales' : 'Acción defensiva')
}

function fallbackBlueDetail(op: string, outcome: OpOutcome, verdict: string): string {
  const ev = outcome.evidence.exchanges[0]
  const base: Record<string, string> = {
    BLOCK: 'Regla de firewall aplicada en el laboratorio: la sesión atacante queda denegada para futuras conexiones.',
    ISOLATE: 'El EDR aisló el host: sus sesiones se revocaron y el nodo deja de responder a la red.',
    PATCH: 'Parche aplicado sobre la vulnerabilidad real del nodo; los siguientes intentos de explotación fallarán.',
    MONITOR: 'Regla de correlación desplegada en el SIEM sobre el tráfico real del segmento.',
    HUNT: 'Barrido forense sobre el diario real de tráfico del laboratorio.',
  }
  return `${base[op] ?? 'Operación defensiva ejecutada.'} ${ev ? `Verificación: ${ev.method} ${ev.path} → ${ev.status}.` : ''} Veredicto: ${verdict}.`
}

// ─────────────────────────────────────────────────────────────
// Modelo de combate — constantes y utilidades
// ─────────────────────────────────────────────────────────────

function pickNodeForPhase(nodes: InfraNode[], phase: Phase): InfraNode {
  const pool =
    phase === 'RECON' || phase === 'ARMADO'
      ? nodes.filter((n) => n.segment === 'DMZ')
      : phase === 'OBJETIVO'
        ? nodes.filter((n) => n.criticality >= 4)
        : nodes
  const list = pool.length > 0 ? pool : nodes
  return rand(list)
}

// ─────────────────────────────────────────────────────────────
// Fallbacks deterministas (modo SIM) — siempre en español
// ─────────────────────────────────────────────────────────────

const RED_FALLBACK: Record<Phase, Array<{ action: string; detail: string; severity: RedDecision['severity'] }>> = {
  RECON: [
    { action: 'Enumeración de servicios expuestos', detail: 'Fingerprinting real de los servicios del nodo objetivo mediante peticiones HTTP directas al laboratorio.', severity: 'LOW' },
    { action: 'Cartografía de la DMZ', detail: 'Consulta rutas públicas y ficheros de configuración expuestos para mapear el perímetro.', severity: 'LOW' },
  ],
  ARMADO: [
    { action: 'Weaponización de exploit', detail: 'Genera un payload determinista y calcula su hash real para la cadena de intrusión.', severity: 'MEDIUM' },
    { action: 'Preparación de infraestructura C2', detail: 'Configura el canal de mando y control para la fase de intrusión.', severity: 'MEDIUM' },
  ],
  INTRUSION: [
    { action: 'Explotación del perímetro', detail: 'Ejecuta el exploit real contra la vulnerabilidad abierta del servicio expuesto.', severity: 'HIGH' },
    { action: 'Phishing dirigido con payload', detail: 'Entrega el payload contra el endpoint objetivo y verifica la ejecución real.', severity: 'HIGH' },
  ],
  ESCALADA: [
    { action: 'Escalada de privilegios local', detail: 'Abusa de la vulnerabilidad local sin parchear del host comprometido para obtener SYSTEM.', severity: 'HIGH' },
    { action: 'Robo y abuso de credenciales', detail: 'Eleva privilegios reutilizando la sesión establecida en el host.', severity: 'CRITICAL' },
  ],
  LATERAL: [
    { action: 'Movimiento lateral por SMB/WMI', detail: 'Pivota hacia el nodo objetivo reutilizando la sesión comprometida (ruta verificada por el laboratorio).', severity: 'HIGH' },
    { action: 'Pivoting sobre jump host', detail: 'Salta al siguiente segmento desde la sesión existente y establece nuevo acceso.', severity: 'CRITICAL' },
  ],
  OBJETIVO: [
    { action: 'Exfiltración de datos críticos', detail: 'Solicita los datos del activo crítico con la sesión privilegiada y verifica la respuesta real.', severity: 'CRITICAL' },
    { action: 'Acceso al activo de misión', detail: 'Extrae la telemetría/documentación sensible del activo objetivo.', severity: 'CRITICAL' },
  ],
}

function fallbackRed(phase: Phase, nodes: InfraNode[], round: number): RedDecision {
  const t = RED_FALLBACK[phase][round % 2]
  const node = pickNodeForPhase(nodes, phase)
  return { action: t.action, detail: t.detail, targetNode: node.id, severity: t.severity }
}

function fallbackLessons(winner: string, redProgress: number, blueProgress: number, redObj: string, blueObj: string) {
  return {
    narrative: `La campaña terminó con ${winner === 'RED' ? 'victoria del RED TEAM' : winner === 'BLUE' ? 'victoria del BLUE TEAM' : 'un empate táctico'} (RED ${redProgress}/100 vs BLUE ${blueProgress}/100). Todos los comandos se verificaron contra el laboratorio real.`,
    red: [
      {
        category: 'LECCION',
        title: 'Ajustar la selección de objetivos por fase',
        content: `El progreso alcanzado fue ${redProgress}/100. En próximas campañas conviene auditar antes los controles del nodo objetivo (${redObj.slice(0, 60)}…) y escalar solo tras confirmar la ruta lateral.`,
        tags: ['planificacion', 'objetivos'],
        confidence: 0.55,
      },
      {
        category: 'TACTICA',
        title: 'Reducir ruido entre fases',
        content: 'Las transiciones entre fases generan telemetría real que el SIEM puede correlacionar. Introducir pausas (dwell time) reduce la probabilidad de detección.',
        tags: ['opsec', 'stealth'],
        confidence: 0.5,
      },
    ],
    blue: [
      {
        category: 'LECCION',
        title: 'Desplegar visibilidad antes de que llegue el impacto',
        content: `La postura defensiva terminó en ${blueProgress}/100. Desplegar reglas de correlación por segmento desde la fase de reconocimiento habría adelantado las detecciones (${blueObj.slice(0, 60)}…).`,
        tags: ['visibilidad', 'siem'],
        confidence: 0.55,
      },
      {
        category: 'DEFENSA',
        title: 'Contención más rápida ante éxito rojo',
        content: 'Cuando el rojo consigue una sesión real, bloquearla inmediatamente y aislar el host limita la escalada de la siguiente fase.',
        tags: ['respuesta', 'contencion'],
        confidence: 0.5,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────
// Recuperación de campañas huérfanas (servidor reiniciado)
// ─────────────────────────────────────────────────────────────

export async function recoverOrphanCampaigns() {
  const running = await db.campaign.findMany({ where: { status: 'RUNNING' } })
  const now = Date.now()
  for (const c of running) {
    const last = await db.campaignEvent.findFirst({ where: { campaignId: c.id }, orderBy: { seq: 'desc' } })
    const lastMs = last ? new Date(last.createdAt).getTime() : new Date(c.startedAt).getTime()
    if (now - lastMs > 120000) {
      await db.campaign.update({ where: { id: c.id }, data: { status: 'ABORTED', endedAt: new Date() } })
    }
  }
}
