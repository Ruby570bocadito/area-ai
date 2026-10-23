// ─────────────────────────────────────────────────────────────
// engine-cierre — cierre de campaña: resolución del ganador,
// narrativa, lecciones, evolución de conocimiento y agentes,
// evento final y fila final de la campaña.
//
// Extraído de engine.ts (refactor-engine-fases) sin cambiar
// comportamiento: el bloque final de runCampaign pasa a
// finalizeCampaign(ctx) con el estado explícito en el contrato.
// La resolución del ganador es la regla canónica de
// src/lib/victory.ts (contrato fijado en tests/victory.test.ts).
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import { llmJson } from './llm'
import { sanitizeForPrompt } from '@/lib/text'
import { normalizeLessonCategory, normalizeLessonTags } from './taxonomy'
import { levelForXp } from './progression'
import { clampProgress, resolveCampaignOutcome } from '@/lib/victory'
import { clamp } from './engine-combate'
import type { EventDraft, LessonDraft } from './types'
import type { LabCampaignState } from '@/lib/lab/types'

export interface CierreCtx {
  campaignId: string
  scenario: { codename: string; company: string; redObjective: string; blueObjective: string }
  redProgress: number
  blueProgress: number
  redScore: number
  blueScore: number
  xpDelta: Map<string, number>
  knowledgeUsed: Map<string, { used: number; worked: number }>
  lab: LabCampaignState
  maxRounds: number
  llmAlive: boolean
  writeEvent: (draft: EventDraft & { command?: string; evidence?: string }) => Promise<void>
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
      {
        category: 'TECNICA',
        title: 'Diversificar objetivos dentro de cada fase',
        content: 'Con dos rondas por fase, repetir nodo y técnica facilita que la defensa correlacione. Alternar vectores sobre activos distintos dispersa la respuesta azul.',
        tags: ['planificacion', 'evasion'],
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
      {
        category: 'INTELIGENCIA',
        title: 'Cerrar la ventana entre golpe y correlación',
        content: 'Con el ritmo alto de las campañas largas, cada ronda sin regla nueva sobre el segmento golpeado es una exfiltración más. Automatizar la regla tras cada confirmado.',
        tags: ['siem', 'duracion'],
        confidence: 0.5,
      },
    ],
  }
}

export async function finalizeCampaign(ctx: CierreCtx): Promise<void> {
  const { campaignId, scenario, redProgress, blueProgress, redScore, blueScore, xpDelta, knowledgeUsed, lab, maxRounds, llmAlive, writeEvent } = ctx

  // Ganador canónico: regla de victoria aplicada sobre el progreso
  // acotado (fuente única en src/lib/victory.ts, compartida con la UI).
  const { winner } = resolveCampaignOutcome(redProgress, blueProgress)

  const allEvents = await db.campaignEvent.findMany({ where: { campaignId }, orderBy: { seq: 'asc' } })
  const compact = allEvents
    .filter((e) => e.team !== 'SYSTEM')
    .map((e) => `${e.team} ${e.agentCodename}: ${sanitizeForPrompt(e.action, 80)} sobre ${e.targetNode ?? '—'} → ${e.result} (impacto ${e.impact}). ${sanitizeForPrompt(e.detail, 240)}`)

  const lessonsSchema = `Devuelve JSON estricto:
{"narrative":"resumen de 4-6 frases de la campaña en español, con el arco de las 12 rondas y los puntos de giro",
 "red":[{"category":"TACTICA|TECNICA|LECCION|VULNERABILIDAD","title":"título corto","content":"2-3 frases del aprendizaje concreto y accionable","tags":["tag1","tag2"],"confidence":0.0-1.0}],
 "blue":[...igual, aprendizajes defensivos...]}`
  const lessonsUser = `Campaña ${scenario.codename} sobre ${scenario.company}. Ganador: ${winner}. Progreso RED ${redProgress}/100, postura BLUE ${blueProgress}/100.
Todo se ejecutó contra un laboratorio real (intercambios HTTP verificados). Eventos:
${compact.join('\n')}

Extrae 3 lecciones por equipo: qué funcionó, qué falló y cómo aplicarlo la próxima campaña. Sé específico.`

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
      redProgress: clampProgress(redProgress),
      blueProgress: clampProgress(blueProgress),
      redScore,
      blueScore,
      endedAt: new Date(),
    },
  })
}
