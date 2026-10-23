// ─────────────────────────────────────────────────────────────
// engine — orquestador del motor de campaña.
//
// Refactor-engine-fases: engine.ts se parte en módulos por
// concepto SIN cambiar comportamiento:
//   · engine-rng.ts     — RNG sembrable y semillas por campaña
//   · engine-select.ts  — selección de agentes y nodos objetivo
//   · engine-combate.ts — momentum RED, escalas, mapeos de fase
//                         y fallbacks deterministas del combate
//   · engine-cierre.ts  — cierre (finalizeCampaign) y fallback
//                         de lecciones
// Este fichero conserva la coordinación: arranque de campaña
// (startCampaign), memoria institucional, bucle de rondas con
// los ejecutores RED/BLUE contra el laboratorio real y la
// recuperación de huérfanas. Re-exporta el contrato público
// histórico para que consumidores y tests no cambien.
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import { llmJson } from './llm'
import { ensureSeed } from './seed'
import { ensureProgressionMigration } from './progression'
import { knowledgeScore } from './knowledge-score'
import { sanitizeForPrompt } from '@/lib/text'
import { createLaunchGate } from './launch-lock'
import {
  BLUE_HUNT_ROLL,
  CHAINABLE_PHASES,
  DEFAULT_SEVERITY_BY_PHASE,
  PARTIAL_IMPACT_FACTOR,
  RED_IMPACT_BY_SEVERITY,
  ajusteDefensivo,
  gananciaAzulAjustada,
  impactoRedAjustado,
  normalizarAjuste,
  DEF_HISTORIAL_TOPE,
} from './pace'
import {
  PHASE_ORDER,
  PHASE_LABEL,
  type Phase,
  type EventDraft,
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
import { clampProgress } from '@/lib/victory'
import { setEngineSeed, engineRoll, rand, newCampaignSeed } from './engine-rng'
import { pickAgentForPhase, pickAgentForOp, pickNodeForPhase, type AgentRow } from './engine-select'
import {
  accumulateProgress,
  bestPatchTarget,
  clamp,
  defaultSignatureFor,
  fallbackBlueDetail,
  fallbackBlueName,
  fallbackRed,
  huntHypothesis,
  redShouldChain,
  segmentForPhase,
  sleep,
} from './engine-combate'
import { finalizeCampaign } from './engine-cierre'

// ── Contrato público de engine.ts (compatibilidad) ─────────
// Los consumidores (app/api/campaigns, app/api/state) y las
// suites tests/engine.test.ts y tests/seed-determinista.test.ts
// importan de aquí; las implementaciones viven en los módulos.

export { setEngineSeed, engineRollProbe, SEED_MAX, newCampaignSeed, acceptSeed, acceptDeterminista, acceptAdaptativa } from './engine-rng'
export { pickAgentForPhase, pickAgentForOp, pickNodeForPhase } from './engine-select'
export { accumulateProgress, redShouldChain, defaultSignatureFor, segmentForPhase, huntHypothesis, bestPatchTarget } from './engine-combate'

// ─────────────────────────────────────────────────────────────
// Arranque de campaña
// ─────────────────────────────────────────────────────────────

const g = globalThis as unknown as { __aegisLLMAlive?: boolean | null }

const launchGate = createLaunchGate()

export async function startCampaign(scenarioId?: string, seed?: number, determinista?: boolean, adaptativa?: boolean) {
  await ensureSeed()
  await ensureProgressionMigration()

  // Cerrojo de lanzamiento (idempotencia-lanzamiento, [verificar] confirmado:
  // 6 POST concurrentes creaban 2 campañas RUNNING — TOCTOU entre el
  // findFirst y el create). El check+create entra en la puerta de
  // src/lib/sim/launch-lock.ts y se ejecuta en serie: el segundo que
  // llega ya ve la RUNNING y termina en CAMPAIGN_RUNNING (409).
  return launchGate(async () => {
    // Sembrar el RNG ANTES de elegir escenario (seed-determinista):
    // la elección de escenario es una tirada más y debe ser
    // reproducible. runCampaign volverá a sembrar con la misma
    // semilla guardada al arrancar el bucle.
    const semilla = seed ?? newCampaignSeed()
    setEngineSeed(semilla)

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

    // ── Dificultad adaptativa (dificultad-adaptativa) ──────
    // Ajuste de la fuerza defensiva según el historial de victorias
    // del escenario, con tope [0.85, 1.15] (pace.ts). Desactivable
    // por campaña (POST {adaptativa:false}; por defecto activa) y
    // neutra de serie en determinista: la reproducibilidad exacta de
    // seed-determinista no admite parámetros que dependan del estado
    // del archivo en el momento del lanzamiento. La fila guardada
    // (adaptativa + ajusteDefensa) refleja lo EFECTIVO, no lo pedido.
    const adaptativaEfectiva = (adaptativa ?? true) && !determinista
    let ajusteDefensa = 1
    if (adaptativaEfectiva) {
      const historial = await db.campaign.findMany({
        where: { scenarioId: scenario.id, status: 'COMPLETED' },
        select: { winner: true },
        orderBy: { startedAt: 'desc' },
        take: DEF_HISTORIAL_TOPE,
      })
      ajusteDefensa = ajusteDefensivo(historial).ajuste
    }

    const campaign = await db.campaign.create({
      data: {
        scenarioId: scenario.id,
        maxRounds: PHASE_ORDER.length,
        status: 'RUNNING',
        phase: 'RECON',
        // Semilla de reproducibilidad (seed-determinista): la que
        // pidió el cliente o una nueva aleatoria. Se GUARDA en BD
        // — es la única forma de reproducir una campaña pasada.
        seed: semilla,
        // Modo determinista forzado: reproducibilidad exacta aunque
        // haya proveedor LLM disponible (runCampaign no sondará).
        determinista: determinista ?? false,
        // Fuerza defensiva congelada (dificultad-adaptativa): el
        // motor solo consume el valor de la fila, nunca recalcula.
        adaptativa: adaptativaEfectiva,
        ajusteDefensa,
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
  })
}

// ─────────────────────────────────────────────────────────────
// Memoria institucional (conocimiento) por equipo
// ─────────────────────────────────────────────────────────────

async function loadMemory(team: 'RED' | 'BLUE'): Promise<KnowledgeRef[]> {
  // Campañas EXTENSAS: la memoria institucional que viaja en cada prompt
  // crece de 8 a 10 referencias (petición directa del usuario).
  const items = await db.knowledge.findMany({ where: { team } })
  items.sort((a, b) => knowledgeScore(b) - knowledgeScore(a))
  return items.slice(0, 10).map((k) => ({
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

// Campañas EXTENSAS: 4 referencias por turno (antes 3) para que cada
// decisión cite más conocimiento archivado.
function pickPhaseKnowledge(mem: KnowledgeRef[], phase: Phase, n = 4): KnowledgeRef[] {
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

  // Semilla de la campaña (seed-determinista): TODAS las tiradas de
  // esta corrida salen de aquí. Null en filas históricas → Math.random
  // (comportamiento previo intacto). Global y seguro: solo vive una
  // campaña a la vez (cerrojo de lanzamiento + guard RUNNING).
  setEngineSeed(campaign.seed ?? undefined)

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

  // ── Sonda de disponibilidad LLM (salta si el determinista está forzado)
  let llmAlive: boolean
  if (campaign.determinista) {
    // seed-determinista: el cliente pidió SIM explícitamente — sin
    // sonda (cero llamadas LLM, arranque inmediato, corrida exacta).
    llmAlive = false
  } else {
    const probe = await llmJson<{ ok: boolean }>('Responde solo con JSON.', 'Confirma disponibilidad devolviendo {"ok": true}', 12000)
    llmAlive = probe?.ok === true
  }
  g.__aegisLLMAlive = llmAlive
  if (!llmAlive) engineMode = 'SIM'

  await db.campaign.update({ where: { id: campaignId }, data: { engineMode } })

  // ── Fuerza defensiva congelada (dificultad-adaptativa) ──
  // El multiplicador se calculó UNA vez en startCampaign y viaja en
  // la fila: re-ejecutar la campaña nunca re-sesga el balance con
  // el archivo actual. Las escalas de pace.ts lo normalizan (banda
  // [0.85, 1.15], no finitos → 1): con neutro el comportamiento es
  // EXACTAMENTE el previo. Se declara ANTES del parte de arranque
  // (evento 0), que lo anuncia cuando actúa.
  const ajusteDefensa = normalizarAjuste(campaign.ajusteDefensa)

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
      // Dificultad adaptativa: se anuncia SOLO cuando actúa (ajuste ≠ 1
      // y activa en la fila); en neutro el parte no añade ruido.
      (campaign.adaptativa && ajusteDefensa !== 1
        ? `Dificultad adaptativa: fuerza defensiva ×${ajusteDefensa.toFixed(2).replace('.', ',')} (${ajusteDefensa > 1 ? 'defensa reforzada' : 'defensa flexibilizada'} por el historial del escenario). `
        : '') +
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
    // Campañas EXTENSAS: el contexto de decisión incluye 10 eventos recientes
    // (antes 6) para que las narrativas mantengan coherencia con el ritmo alto.
    const evs = await db.campaignEvent.findMany({
      where: { campaignId, team: { not: 'SYSTEM' } },
      orderBy: { seq: 'desc' },
      take: 10,
    })
    return evs.reverse().map((e) => `[R${e.round}/${e.phase}] ${e.team} ${e.agentCodename ?? ''}: ${sanitizeForPrompt(e.action, 80)} → ${e.result ?? '—'} (impacto ${e.impact}). ${sanitizeForPrompt(e.detail, 240)}`)
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
${redMem.map((k) => `- [${k.category}] ${sanitizeForPrompt(k.title, 140)}: ${sanitizeForPrompt(k.content, 300)} (confianza ${(k.confidence * 100).toFixed(0)}%)`).join('\n') || '— primera campaña, sin memoria —'}

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

    // ── Impacto derivado del resultado real (escalas en pace.ts)
    const severity = (redDec.severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(redDec.severity) ? redDec.severity : DEFAULT_SEVERITY_BY_PHASE[phase]) as string
    const critFactor = 0.7 + target.criticality / 10
    let impact = 0
    // Dificultad adaptativa: el impacto ofensivo sale de las escalas
    // de pace.ts escalado por la fuerza defensiva congelada
    // (cero-suma: defensa ×1.15 ⇒ ofensiva ×0.85). Con ajuste 1 la
    // fórmula es EXACTAMENTE la previa.
    if (outcome.result === 'EXITO') impact = impactoRedAjustado(RED_IMPACT_BY_SEVERITY[severity] * critFactor * (1 - blueProgress / 160), ajusteDefensa)
    else if (outcome.result === 'PARCIAL') impact = impactoRedAjustado(RED_IMPACT_BY_SEVERITY[severity] * PARTIAL_IMPACT_FACTOR, ajusteDefensa)
    impact = clamp(impact, 0, 20)
    // Escala cerrada [0, 100]: acumulación RED acotada en memoria (simétrica a
    // blueProgress más abajo), para que el ganador, la narrativa, las lecciones
    // y la fila final compartan el mismo valor sin desbordamiento (Ronda 9 de
    // bugs: la evidencia "114/100" provenía de acumular aquí sin acotar).
    redProgress = accumulateProgress(redProgress, impact)
    redScore += impact + (outcome.result === 'FALLO' ? 1 : 0)
    trackKnowledge(redTurnIds, outcome.result !== 'FALLO')
    xpDelta.set(agent.key, (xpDelta.get(agent.key) ?? 0) + 6 + Math.round(impact / 3))

    await writeEvent({
      round,
      phase,
      team: 'RED',
      agentKey: agent.key,
      agentCodename: agent.codename,
      // Salida del LLM acotada y a una línea: sin techo, un detail gigante
      // se archivaba íntegro y reentraba en prompts posteriores (tarea
      // prompt-injection-evidencia del ROADMAP).
      action: sanitizeForPrompt(redDec.action, 80),
      detail: sanitizeForPrompt(redDec.detail, 400),
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
      data: { round, phase, redProgress: clampProgress(redProgress), blueProgress: clampProgress(blueProgress), redScore, blueScore },
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
        `Operación ejecutada: ${sanitizeForPrompt(outcome.command, 200)}
Veredicto real: ${verdict}. Evidencia: ${sanitizeForPrompt(JSON.stringify(outcome.evidence), 700)}
Contexto: fase ${PHASE_LABEL[phase]}, ronda ${round}.`,
        18000
      )
      if (narr?.action) actionName = sanitizeForPrompt(narr.action, 80)
      if (narr?.detail) detail = sanitizeForPrompt(narr.detail, 400)
    }
    if (!actionName) actionName = fallbackBlueName(op, verdict)
    if (!detail) detail = fallbackBlueDetail(op, outcome, verdict)

    // Dificultad adaptativa: la ganancia defensiva escala con la
    // fuerza congelada en la fila; la ganancia fija de blindaje (+2)
    // NO se toca — contrato documentado de la telemetría (pace.ts).
    const defImpact = gananciaAzulAjustada(verdict, ajusteDefensa)
    blueProgress = accumulateProgress(blueProgress, defImpact + 2)
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
      data: { round, phase, redProgress: clampProgress(redProgress), blueProgress: clampProgress(blueProgress), redScore, blueScore },
    })
    await sleep(500)
  }

  // ─────────────────────────────────────────────────────────
  // Bucle de rondas con CADENCIA DINÁMICA e INTENSIDAD (no 1-1):
  // RED abre; si prospera puede encadenar (0.65 tras ÉXITO, 0.35
  // tras PARCIAL); BLUE responde SIEMPRE — a detecciones reales
  // del SIEM, a golpes confirmados sin correlación aún, o de
  // forma proactiva (caza o endurecimiento) cuando no hubo
  // señal. 3-6 acciones por ronda, orden variable. Parámetros
  // de ritmo en pace.ts.
  // ─────────────────────────────────────────────────────────

  // Reacción defensiva a una acción RED ya ejecutada: responde a
  // detecciones reales del SIEM y, si no hay correlación pero el
  // golpe está confirmado (ÉXITO/PARCIAL en fase de contacto),
  // responde igualmente cortando sesión, parcheando o monitorizando.
  // Devuelve true si BLUE actuó (para la cadencia de la ronda).
  async function blueReact(round: number, phase: Phase, redResult: string | undefined, targetId: string, newExchanges: LabCampaignState['journal']): Promise<boolean> {
    const detections = evaluateDetections(lab, newExchanges.map((e) => e.id))
    const sessionToBlock = [...lab.sessions.values()].find((s) => s.team === 'RED' && !s.revoked && s.homeNodeId === targetId)?.id

    if (detections.length > 0) {
      const detPayload = detections.map((d) => ({ nodeId: d.nodeId, signature: d.signature as Signature })).filter((x, i, arr) => arr.findIndex((y) => y.nodeId === x.nodeId && y.signature === x.signature) === i)
      const op = sessionToBlock && phase !== 'RECON' ? 'BLOCK' : 'MONITOR'
      await blueAct(round, phase, op, {
        detections: detPayload,
        sessionToBlock: op === 'BLOCK' ? sessionToBlock : undefined,
        redNode: targetId,
      })
      return true
    }

    // Respuesta a golpe confirmado aunque el SIEM aún no haya
    // correlacionado: endurece el nodo golpeado (parchea la vuln
    // explotada) o monitoriza, pero NO revoca sesiones — el bloqueo
    // de sesión queda reservado a detecciones reales del SIEM.
    // Cortar la sesión en cuanto RED toca tierra vaciaba el resto
    // de la kill-chain en cascada (calibrado con campañas reales:
    // finales RED 22-26/100 con la escalada entera en FALLO).
    if (CHAINABLE_PHASES.includes(phase) && (redResult === 'EXITO' || redResult === 'PARCIAL')) {
      const { nodeId, vuln } = bestPatchTarget(lab, targetId)
      if (nodeId && vuln) {
        await blueAct(round, phase, 'PATCH', { patchNode: nodeId, patchVuln: vuln, redNode: targetId })
        return true
      }
      await blueAct(round, phase, 'MONITOR', { redNode: targetId })
      return true
    }

    return false
  }

  for (let round = 1; round <= maxRounds; round++) {
    const phase = PHASE_ORDER[round - 1]
    setLabRound(campaignId, round)
    const redAgent = pickAgentForPhase(redAgents, phase, round)

    let blueActionsThisRound = 0

    // 1) Acción RED obligatoria + respuesta defensiva inmediata
    const first = await redAct(round, phase, redAgent)
    let lastTarget = first.target
    let lastOutcome = first.outcome
    if (await blueReact(round, phase, first.outcome.result, lastTarget.id, first.newExchanges)) blueActionsThisRound++

    // 2) RED encadena con el momentum vivo (ÉXITO alto, PARCIAL moderado)
    if (CHAINABLE_PHASES.includes(phase)) {
      if (redShouldChain(lastOutcome.result, engineRoll())) {
        const second = await redAct(round, phase, redAgent, lastTarget.id)
        lastTarget = second.target
        lastOutcome = second.outcome
        if (await blueReact(round, phase, second.outcome.result, lastTarget.id, second.newExchanges)) blueActionsThisRound++
      }
    }

    // 3) BLUE proactivo SIEMPRE que no haya actuado todavía: una defensa
    // que solo espera no defiende (antes 15% de rondas sin respuesta azul).
    // Endurecimiento CON CRITERIO: con señales vivas de compromiso (sesiones
    // RED o nodos comprometidos) parchea el mejor objetivo; sin ellas,
    // monitoriza — el parche ciego ronda a ronda vaciaría la superficie
    // explotable y mataría el arco ofensivo (calibrado con campañas reales).
    if (blueActionsThisRound === 0) {
      if (engineRoll() < BLUE_HUNT_ROLL) {
        await blueAct(round, phase, 'HUNT', { hypothesis: huntHypothesis(phase), redNode: lastTarget.id })
        blueActionsThisRound++
      } else {
        const liveCompromise =
          [...lab.sessions.values()].some((s) => s.team === 'RED' && !s.revoked) ||
          [...lab.nodes.values()].some((n) => n.compromised)
        const { nodeId, vuln } = liveCompromise ? bestPatchTarget(lab, lastTarget.id) : { nodeId: undefined, vuln: undefined }
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
  // Cierre: ganador, narrativa, lecciones y evolución —
  // delegado en engine-cierre.ts (finalizeCampaign). El estado
  // mutable del bucle viaja explícito en el contrato; writeEvent
  // sigue siendo el cierre del bucle (secuencia compartida).
  // ─────────────────────────────────────────────────────────
  await finalizeCampaign({
    campaignId,
    scenario,
    redProgress,
    blueProgress,
    redScore,
    blueScore,
    xpDelta,
    knowledgeUsed,
    lab,
    maxRounds,
    llmAlive,
    writeEvent,
  })
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
