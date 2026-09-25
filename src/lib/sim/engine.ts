import { db } from '@/lib/db'
import { llmJson } from './llm'
import { ensureSeed } from './seed'
import { RED_AGENTS, BLUE_AGENTS } from './roster'
import {
  PHASE_ORDER,
  PHASE_LABEL,
  type Phase,
  type EventDraft,
  type LessonDraft,
  type RedDecision,
  type BlueDecision,
  type KnowledgeRef,
  type Infrastructure,
  type InfraNode,
} from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const rand = (arr: unknown[]) => arr[Math.floor(Math.random() * arr.length)]

const g = globalThis as unknown as { __aegisLLMAlive?: boolean | null }

/** Mapa agentKey → fases en las que toma la iniciativa (definido en el roster) */
const AGENT_PHASES = new Map<string, Phase[]>(
  [...RED_AGENTS, ...BLUE_AGENTS].map((a) => [a.key, a.phases])
)

/** Elige el agente de la fase, rotando entre los que comparten fase para que todos participen */
function pickAgentForPhase<T extends { key: string }>(agents: T[], phase: Phase, round: number): T {
  const matches = agents.filter((a) => (AGENT_PHASES.get(a.key) ?? []).includes(phase))
  if (matches.length === 0) return agents[0]
  return matches[(round - 1) % matches.length]
}

// ─────────────────────────────────────────────────────────────
// Arranque de campaña
// ─────────────────────────────────────────────────────────────

export async function startCampaign(scenarioId?: string) {
  await ensureSeed()

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

function knowledgeScore(k: { confidence: number; timesUsed: number; timesWorked: number }): number {
  const ratio = k.timesUsed > 0 ? k.timesWorked / k.timesUsed : 0.5
  return k.confidence * 0.6 + ratio * 0.3 + Math.min(1, k.timesUsed / 10) * 0.1
}

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
// Bucle principal de campaña
// ─────────────────────────────────────────────────────────────

async function runCampaign(campaignId: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, include: { scenario: true } })
  if (!campaign) return

  const scenario = campaign.scenario
  const infra = JSON.parse(scenario.infrastructure) as Infrastructure
  const nodes: InfraNode[] = infra.nodes
  const redAgents = await db.agent.findMany({ where: { team: 'RED' } })
  const blueAgents = await db.agent.findMany({ where: { team: 'BLUE' } })

  let seq = 0
  let engineMode = 'LLM'

  const writeEvent = async (draft: EventDraft) => {
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
      },
    })
  }

  // ── Sonda de disponibilidad LLM (evita esperas largas si no hay LLM)
  const probe = await llmJson<{ ok: boolean }>('Responde solo con JSON.', 'Confirma disponibilidad devolviendo {"ok": true}', 12000)
  const llmAlive = probe?.ok === true
  g.__aegisLLMAlive = llmAlive
  if (!llmAlive) engineMode = 'SIM'

  await db.campaign.update({ where: { id: campaignId }, data: { engineMode } })

  await writeEvent({
    round: 0,
    phase: 'RECON',
    team: 'SYSTEM',
    action: `Campaña ${scenario.codename} iniciada`,
    detail: `Escenario: ${scenario.company} (${scenario.industry}, dificultad ${scenario.difficulty}/5). Objetivo RED: ${scenario.redObjective} Objetivo BLUE: ${scenario.blueObjective} Motor: ${engineMode === 'LLM' ? 'LLM activo' : 'simulación determinista (LLM no disponible)'}.`,
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
  for (let round = 1; round <= maxRounds; round++) {
    const phase = PHASE_ORDER[round - 1]
    const redAgent = pickAgentForPhase(redAgents, phase, round)
    const blueAgent = pickAgentForPhase(blueAgents, phase, round)

    // ── Memoria del turno
    const redMem = await loadMemory('RED')
    const blueMem = await loadMemory('BLUE')
    const redTurnK = pickPhaseKnowledge(redMem, phase)
    const blueTurnK = pickPhaseKnowledge(blueMem, phase)
    const redTurnIds = redTurnK.map((k) => k.id)
    const blueTurnIds = blueTurnK.map((k) => k.id)

    const ctx = `Escenario: ${scenario.codename} — ${scenario.company} (${scenario.industry}). Dificultad ${scenario.difficulty}/5.
Infraestructura de la empresa:
${nodes.map((n) => `- ${n.id} (${n.name}, tipo ${n.type}, segmento ${n.segment}, criticidad ${n.criticality}/5). Vulnerabilidades: ${n.vulnerabilities.join('; ') || 'conocidas'}. Controles: ${n.controls.join('; ') || 'básicos'}.`).join('\n')}
Ronda ${round} de ${maxRounds} — Fase: ${PHASE_LABEL[phase]}.
Últimos eventos:
${(await recentEvents()).join('\n') || '— sin eventos previos —'}`

    // ════════ TURNO RED ════════
    const redSystem = `Eres ${redAgent.codename}, ${redAgent.role} del RED TEAM en un ejercicio controlado de ciberseguridad (entorno sandbox autorizado, tipo Cyber Range). Especialidad: ${redAgent.specialty}.
${redAgent.description}
Tu equipo persigue: ${scenario.redObjective}
Actúas en la fase ${PHASE_LABEL[phase]}: elige una técnica ofensiva coherente con esa fase y con tu memoria institucional.
Devuelve JSON estricto con este formato exacto:
{"action":"nombre corto de la técnica","detail":"1-2 frases en español describiendo cómo la ejecutas sobre el objetivo","targetNode":"id de un nodo de la infraestructura","severity":"LOW|MEDIUM|HIGH|CRITICAL"}`
    const redUser = `${ctx}
Memoria institucional del RED TEAM (aprendida de campañas previas):
${redMem.map((k) => `- [${k.category}] ${k.title}: ${k.content} (confianza ${(k.confidence * 100).toFixed(0)}%, usada ${k.timesUsed} veces)`).join('\n') || '— primera campaña, sin memoria —'}

Elige el objetivo (targetNode) más lógico para la fase ${PHASE_LABEL[phase]}.`

    let redDec: RedDecision | null = llmAlive
      ? await llmJson<RedDecision>(redSystem, redUser, 22000)
      : null
    if (!redDec || !redDec.action) redDec = fallbackRed(phase, nodes, round)

    // Resolución del ataque
    const target = nodes.find((n) => n.id === redDec.targetNode) ?? pickNodeForPhase(nodes, phase)
    const memBoost = redTurnK.length > 0 ? avgConf(redTurnK) * 0.15 : 0
    const pRed = clamp(
      BASE_RED[phase] + redAgent.level * 0.03 + memBoost - scenario.difficulty * 0.03 - (blueProgress / 100) * 0.25,
      0.15,
      0.92
    )
    const roll = Math.random()
    const redResult: 'EXITO' | 'PARCIAL' | 'FALLO' = roll < pRed ? 'EXITO' : roll < pRed + 0.2 ? 'PARCIAL' : 'FALLO'
    const sevImpact: Record<string, number> = { LOW: 4, MEDIUM: 7, HIGH: 11, CRITICAL: 16 }
    let impact = 0
    if (redResult === 'EXITO') impact = Math.round((sevImpact[redDec.severity] ?? 7) * (1 - blueProgress / 160))
    else if (redResult === 'PARCIAL') impact = Math.round((sevImpact[redDec.severity] ?? 7) * 0.45)
    redProgress = clamp(redProgress + impact, 0, 100)
    redScore += impact + (redResult === 'FALLO' ? 1 : 0)
    trackKnowledge(redTurnIds, redResult !== 'FALLO')
    xpDelta.set(redAgent.key, (xpDelta.get(redAgent.key) ?? 0) + 8 + Math.round(impact / 2))

    await writeEvent({
      round,
      phase,
      team: 'RED',
      agentKey: redAgent.key,
      agentCodename: redAgent.codename,
      action: redDec.action,
      detail: redDec.detail,
      result: redResult,
      impact,
      severity: redDec.severity ?? 'MEDIUM',
      targetNode: target.id,
    })
    await sleep(650)

    // ════════ TURNO BLUE ════════
    const blueSystem = `Eres ${blueAgent.codename}, ${blueAgent.role} del BLUE TEAM (defensa) en un ejercicio controlado de ciberseguridad (entorno sandbox autorizado, tipo Cyber Range). Especialidad: ${blueAgent.specialty}.
${blueAgent.description}
Tu equipo debe lograr: ${scenario.blueObjective}
El RED TEAM acaba de actuar en la fase ${PHASE_LABEL[phase]}. Decide tu acción defensiva: detectar, bloquear, contener o endurecer.
Devuelve JSON estricto con este formato exacto:
{"action":"nombre corto de la acción defensiva","detail":"1-2 frases en español describiendo qué haces y con qué herramienta/regla","verdict":"BLOQUEADO|DETECTADO|CONTENIDO|IGNORADO"}`
    const blueUser = `${ctx}
Memoria institucional del BLUE TEAM (aprendida de campañas previas):
${blueMem.map((k) => `- [${k.category}] ${k.title}: ${k.content} (confianza ${(k.confidence * 100).toFixed(0)}%, usada ${k.timesUsed} veces)`).join('\n') || '— primera campaña, sin memoria —'}

Última acción del RED TEAM: "${redDec.action}" sobre ${target.id} (${target.name}) — resultado para el rojo: ${redResult}.`

    let blueDec: BlueDecision | null = llmAlive
      ? await llmJson<BlueDecision>(blueSystem, blueUser, 22000)
      : null
    if (!blueDec || !blueDec.action) blueDec = fallbackBlue(phase, target, redResult, round)

    // Resolución de la defensa
    const pBlue = clamp(
      0.5 + blueAgent.level * 0.03 + (blueTurnK.length > 0 ? avgConf(blueTurnK) * 0.15 : 0) - (redDec.severity === 'CRITICAL' ? 0.12 : 0) + (blueProgress / 100) * 0.1,
      0.15,
      0.9
    )
    const defVerdict = blueDec.verdict ?? (Math.random() < pBlue ? (phase === 'RECON' ? 'DETECTADO' : 'BLOQUEADO') : 'IGNORADO')
    const defGain: Record<string, number> = { BLOQUEADO: 10, DETECTADO: 6, CONTENIDO: 4, IGNORADO: 1 }
    let defImpact = defGain[defVerdict] ?? 1
    if (defVerdict === 'IGNORADO' && redResult === 'FALLO') defImpact = 2
    blueProgress = clamp(blueProgress + defImpact + 2, 0, 100) // +2 endurecimiento pasivo
    blueScore += defImpact * 2
    trackKnowledge(blueTurnIds, defVerdict === 'BLOQUEADO' || defVerdict === 'DETECTADO')
    xpDelta.set(blueAgent.key, (xpDelta.get(blueAgent.key) ?? 0) + 6 + defImpact)

    await writeEvent({
      round,
      phase,
      team: 'BLUE',
      agentKey: blueAgent.key,
      agentCodename: blueAgent.codename,
      action: blueDec.action,
      detail: blueDec.detail,
      result: defVerdict,
      impact: defImpact,
      severity: defVerdict === 'BLOQUEADO' ? 'LOW' : defVerdict === 'IGNORADO' ? 'HIGH' : 'MEDIUM',
      targetNode: target.id,
    })
    await sleep(650)

    await db.campaign.update({
      where: { id: campaignId },
      data: { round, phase, redProgress, blueProgress, redScore, blueScore },
    })
  }

  // ─────────────────────────────────────────────────────────
  // Cierre: ganador, narrativa, lecciones y evolución
  // ─────────────────────────────────────────────────────────
  const winner: 'RED' | 'BLUE' | 'DRAW' =
    redProgress >= 70 && redProgress > blueProgress ? 'RED' : redProgress < 45 ? 'BLUE' : 'DRAW'

  const allEvents = await db.campaignEvent.findMany({ where: { campaignId }, orderBy: { seq: 'asc' } })
  const compact = allEvents
    .filter((e) => e.team !== 'SYSTEM')
    .map((e) => `${e.team} ${e.agentCodename}: ${e.action} sobre ${e.targetNode ?? '—'} → ${e.result} (impacto ${e.impact}). ${e.detail}`)

  const lessonsSchema = `Devuelve JSON estricto:
{"narrative":"resumen cinematográfico de 3-4 frases de la campaña en español",
 "red":[{"category":"TACTICA|TECNICA|LECCION|VULNERABILIDAD","title":"título corto","content":"2-3 frases del aprendizaje concreto y accionable para futuras campañas","tags":["tag1","tag2"],"confidence":0.0-1.0}],
 "blue":[...igual, aprendizajes defensivos...]}`
  const lessonsUser = `Campaña ${scenario.codename} sobre ${scenario.company}. Ganador: ${winner}. Progreso RED ${redProgress}/100, postura BLUE ${blueProgress}/100.
Objetivo RED: ${scenario.redObjective}
Objetivo BLUE: ${scenario.blueObjective}
Eventos:
${compact.join('\n')}

Extrae 2 lecciones por equipo: qué funcionó, qué falló y cómo aplicarlo la próxima campaña. Sé específico (nombres de técnicas, controles, nodos).`

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
          category: l.category ?? 'LECCION',
          title: String(l.title).slice(0, 140),
          content: String(l.content).slice(0, 900),
          tags: Array.isArray(l.tags) ? l.tags.join(',').slice(0, 200) : 'general',
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

  // Actualizar agentes (XP, nivel, victorias)
  const allAgents = await db.agent.findMany()
  for (const a of allAgents) {
    const xp = a.xp + (xpDelta.get(a.key) ?? 0)
    const isWinner = (winner === 'RED' && a.team === 'RED') || (winner === 'BLUE' && a.team === 'BLUE')
    await db.agent.update({
      where: { id: a.id },
      data: {
        xp,
        level: 1 + Math.floor(xp / 80),
        campaigns: a.campaigns + 1,
        victories: a.victories + (isWinner ? 1 : 0),
      },
    })
  }

  await writeEvent({
    round: maxRounds,
    phase: 'OBJETIVO',
    team: 'SYSTEM',
    action: `Fin de la campaña — victoria: ${winner === 'RED' ? 'RED TEAM' : winner === 'BLUE' ? 'BLUE TEAM' : 'EMPATE'}`,
    detail: `${narrative} Lecciones archivadas: ${lessons.red?.length ?? 0} del RED, ${lessons.blue?.length ?? 0} del BLUE. Se aplicarán en próximas campañas.`,
    severity: 'INFO',
  })

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'COMPLETED',
      winner,
      narrative,
      redProgress,
      blueProgress,
      redScore,
      blueScore,
      endedAt: new Date(),
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Modelo de combate — constantes y utilidades
// ─────────────────────────────────────────────────────────────

const BASE_RED: Record<Phase, number> = {
  RECON: 0.8,
  ARMADO: 0.72,
  INTRUSION: 0.55,
  ESCALADA: 0.5,
  LATERAL: 0.5,
  OBJETIVO: 0.42,
}

function avgConf(items: KnowledgeRef[]): number {
  if (items.length === 0) return 0
  return items.reduce((s, k) => s + k.confidence, 0) / items.length
}

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
    { action: 'Enumeración pasiva de superficie', detail: 'Recolecta subdominios, rangos IP y certificados TLS desde fuentes públicas sin contacto directo con la víctima.', severity: 'LOW' },
    { action: 'Fingerprinting de servicios expuestos', detail: 'Identifica versiones exactas de servicios en la DMZ correlacionando banners y repositorios públicos.', severity: 'LOW' },
  ],
  ARMADO: [
    { action: 'Weaponización de exploit', detail: 'Prepara una carga adaptada a las versiones detectadas y un dominio de señuelo para la campaña.', severity: 'MEDIUM' },
    { action: 'Preparación de infraestructura C2', detail: 'Despliega servidor de mando y control con dominio rotado y certificado legítimo.', severity: 'MEDIUM' },
  ],
  INTRUSION: [
    { action: 'Explotación del perímetro', detail: 'Explota la vulnerabilidad conocida del servicio expuesto para obtener un shell inicial en la DMZ.', severity: 'HIGH' },
    { action: 'Phishing dirigido con payload', detail: 'Envía un documento malicioso personalizado a un empleado con acceso privilegiado.', severity: 'HIGH' },
  ],
  ESCALADA: [
    { action: 'Robo de credenciales en memoria', detail: 'Dumpea LSASS y extrae hashes NTLM y tickets Kerberos del host comprometido.', severity: 'HIGH' },
    { action: 'Abuso de misconfiguration de privilegios', detail: 'Aprovecha delegaciones y grupos legacy para obtener privilegios de administrador.', severity: 'CRITICAL' },
  ],
  LATERAL: [
    { action: 'Movimiento lateral por SMB/WMI', detail: 'Usa credenciales robadas para pivotar hacia el segmento core reutilizando sesiones legítimas.', severity: 'HIGH' },
    { action: 'Pivoting sobre jump host', detail: 'Compromete el host de salto y reutiliza su sesión confiable para alcanzar la red protegida.', severity: 'CRITICAL' },
  ],
  OBJETIVO: [
    { action: 'Exfiltración por canal cifrado', detail: 'Comprime y exfiltra los datos críticos por HTTPS hacia el C2 fragmentando el tráfico.', severity: 'CRITICAL' },
    { action: 'Despliegue de ransomware y borrado de rastros', detail: 'Despliega el cifrador en el activo crítico y limpia logs para retrasar la respuesta.', severity: 'CRITICAL' },
  ],
}

function fallbackRed(phase: Phase, nodes: InfraNode[], round: number): RedDecision {
  const t = RED_FALLBACK[phase][round % 2]
  const node = pickNodeForPhase(nodes, phase)
  return { action: t.action, detail: t.detail, targetNode: node.id, severity: t.severity }
}

const BLUE_FALLBACK: Record<Phase, Array<{ action: string; detail: string }>> = {
  RECON: [
    { action: 'Correlación de alertas de enumeración', detail: 'Ajusta reglas SIEM para detectar patrones de enumeración DNS y banners inusuales desde ASN externos.' },
    { action: 'Revisión de superficie expuesta', detail: 'Audita activos expuestos y cierra servicios innecesarios detectados en el inventario.' },
  ],
  ARMADO: [
    { action: 'Threat intelligence y bloqueo de IOCs', detail: 'Actualiza feeds de IOCs y refuerza reglas de correo y proxy ante campañas de weaponización.' },
    { action: 'Parcheo urgente de activos críticos', detail: 'Prioriza el parcheo de servicios de borde con versiones vulnerables conocidas.' },
  ],
  INTRUSION: [
    { action: 'Bloqueo en WAF e IPS', detail: 'Despliega firmas específicas contra el payload observado y aísla el host afectado para análisis.' },
    { action: 'Respuesta a incidente inicial', detail: 'Aísla el endpoint comprometido, revoca sesiones y captura memoria para forense.' },
  ],
  ESCALADA: [
    { action: 'Rotación de credenciales privilegiadas', detail: 'Fuerza rotación de contraseñas y tickets Kerberos; activa cuentas honey para detectar abuso.' },
    { action: 'Endurecimiento de PAM', detail: 'Aplica políticas de least privilege y habilita monitorización intensiva de cuentas administrativas.' },
  ],
  LATERAL: [
    { action: 'Segmentación de emergencia', detail: 'Restringe tráfico east-west con reglas temporales y monitoriza intentos de pivoting.' },
    { action: 'Threat hunting en el segmento core', detail: 'Rastrea artefactos de movimiento lateral en hosts críticos y verifica integridad de hashes.' },
  ],
  OBJETIVO: [
    { action: 'Contención de exfiltración', detail: 'Bloquea canales salientes sospechosos y verifica integridad de los datos críticos en backups.' },
    { action: 'Recuperación y endurecimiento final', detail: 'Restaura desde copias inmutables, cierra la vía de acceso y documenta la cadena de ataque.' },
  ],
}

function fallbackBlue(phase: Phase, target: InfraNode, redResult: string, round: number): BlueDecision {
  const t = BLUE_FALLBACK[phase][round % 2]
  const verdict =
    redResult === 'FALLO' ? 'BLOQUEADO' : redResult === 'PARCIAL' ? 'DETECTADO' : Math.random() < 0.55 ? 'CONTENIDO' : 'IGNORADO'
  return { action: t.action, detail: `${t.detail} Foco en ${target.name} (${target.id}).`, verdict }
}

function fallbackLessons(winner: string, redProgress: number, blueProgress: number, redObj: string, blueObj: string) {
  return {
    narrative: `La campaña terminó con ${winner === 'RED' ? 'victoria del RED TEAM' : winner === 'BLUE' ? 'victoria del BLUE TEAM' : 'un empate táctico'} (RED ${redProgress}/100 vs BLUE ${blueProgress}/100). Ambos equipos archivan sus hallazgos y ajustarán sus tácticas en la siguiente campaña.`,
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
        content: 'Las transiciones entre fases generan telemetría. Introducir pausas (dwell time) y reutilizar sesiones legítimas reduce la probabilidad de detección.',
        tags: ['opsec', 'stealth'],
        confidence: 0.5,
      },
    ],
    blue: [
      {
        category: 'LECCION',
        title: 'Priorizar visibilidad en el segmento atacado',
        content: `La postura defensiva terminó en ${blueProgress}/100. Reforzar logging en los nodos de mayor criticidad y correlacionar eventos entre fases habría adelantado la detección.`,
        tags: ['visibilidad', 'siem'],
        confidence: 0.55,
      },
      {
        category: 'DEFENSA',
        title: 'Contención más rápida ante éxito rojo',
        content: 'Cuando el rojo consigue éxito en una fase, aislar el host afectado y rotar credenciales inmediatamente limita la escalada de la siguiente fase.',
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
