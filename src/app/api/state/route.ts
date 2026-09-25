import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/sim/seed'
import { recoverOrphanCampaigns } from '@/lib/sim/engine'
import { getAutopilot, maybeRunAutopilot } from '@/lib/sim/autopilot'
import { llmProviderName } from '@/lib/sim/llm'
import { knowledgeScore } from '@/lib/sim/knowledge-score'
import { labInfo } from '@/lib/lab/store'
import type { Infrastructure } from '@/lib/sim/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    await recoverOrphanCampaigns()
    // Operación continua: si está activa y el motor está ocioso, lanza la siguiente campaña real
    await maybeRunAutopilot()

    const [agents, scenarios, campaigns, activeCampaign, knowledges] = await Promise.all([
      db.agent.findMany({ orderBy: [{ team: 'asc' }, { xp: 'desc' }] }),
      db.scenario.findMany({ orderBy: { difficulty: 'asc' } }),
      db.campaign.findMany({
        orderBy: { startedAt: 'desc' },
        take: 15,
        include: { scenario: true },
      }),
      db.campaign.findFirst({
        where: { status: 'RUNNING' },
        include: { scenario: true },
      }),
      db.knowledge.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    ])

    // Campaña a mostrar en vivo: activa o la última
    const liveCampaign = activeCampaign ?? campaigns[0] ?? null
    const liveEvents = liveCampaign
      ? await db.campaignEvent.findMany({
          where: { campaignId: liveCampaign.id },
          orderBy: { seq: 'asc' },
          take: 200,
        })
      : []

    // Actividad reciente del laboratorio: últimos eventos reales entre campañas
    const recentRaw = await db.campaignEvent.findMany({
      where: { team: { not: 'SYSTEM' } },
      orderBy: { createdAt: 'desc' },
      take: 14,
      include: { campaign: { include: { scenario: { select: { codename: true } } } } },
    })
    const recentActivity = recentRaw.map((e) => ({
      id: e.id,
      team: e.team as 'RED' | 'BLUE',
      agentCodename: e.agentCodename,
      action: e.action,
      result: e.result,
      phase: e.phase,
      impact: e.impact,
      campaignCodename: e.campaign.scenario.codename,
      createdAt: e.createdAt,
    }))

    // Chispa de conocimiento: lecciones creadas por día (últimos 14 días).
    // Ronda 11 de bugs: antes se consultaba la tabla COMPLETA (findMany sin
    // where) y se filtraba en memoria — la ventana útil es 14 días, así que
    // el where acota la consulta al mínimo que la gráfica puede representar
    // y el coste deja de crecer con el histórico.
    const dayMs = 24 * 3600 * 1000
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const allKnowledgeRows = await db.knowledge.findMany({
      where: { createdAt: { gte: new Date(today.getTime() - 14 * dayMs) } },
      select: { createdAt: true },
    })
    const knowledgeSpark: number[] = []
    for (let d = 13; d >= 0; d--) {
      const end = today.getTime() - d * dayMs
      const start = end - dayMs
      knowledgeSpark.push(allKnowledgeRows.filter((k) => {
        const t = new Date(k.createdAt).getTime()
        return t > start && t <= end
      }).length)
    }

    // Estado real del laboratorio (servicios HTTP del ciber range)
    const info = labInfo()
    const liveLab = liveCampaign ? info.campaigns.find((c) => c.campaignId === liveCampaign.id) ?? null : null

    const completed = campaigns.filter((c) => c.status === 'COMPLETED')
    const redWins = completed.filter((c) => c.winner === 'RED').length
    const blueWins = completed.filter((c) => c.winner === 'BLUE').length

    const redK = knowledges.filter((k) => k.team === 'RED')
    const blueK = knowledges.filter((k) => k.team === 'BLUE')
    const avgConf = (arr: typeof knowledges) =>
      arr.length > 0 ? arr.reduce((s, k) => s + k.confidence, 0) / arr.length : 0.4
    const winRate = (wins: number) => (completed.length > 0 ? wins / completed.length : 0.35)
    const evolutionRed = Math.round(50 + avgConf(redK) * 30 + winRate(redWins) * 20)
    const evolutionBlue = Math.round(50 + avgConf(blueK) * 30 + winRate(blueWins) * 20)

    // knowledge ordenado por "fuerza" para mostrar
    const redKnowledge = [...redK].sort((a, b) => knowledgeScore(b) - knowledgeScore(a)).slice(0, 24)
    const blueKnowledge = [...blueK].sort((a, b) => knowledgeScore(b) - knowledgeScore(a)).slice(0, 24)

    // infraestructura de la campaña en vivo
    // Parse defensivo: /api/state es la ruta de sondeo de toda la UI y del
    // autopilot — un escenario con infrastructure corrupta NO debe tumbar
    // el endpoint entero (mismo criterio que GET /api/campaigns/[id]).
    let liveInfra: Infrastructure | null = null
    if (liveCampaign) {
      try {
        const parsed = JSON.parse(liveCampaign.scenario.infrastructure) as Infrastructure
        if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) liveInfra = parsed
      } catch {
        liveInfra = null
      }
    }

    return NextResponse.json({
      ok: true,
      provider: await llmProviderName(),
      autopilot: await getAutopilot(),
      agents,
      scenarios: scenarios.map((s) => ({ ...s, infrastructure: undefined })),
      campaigns,
      activeCampaign,
      liveCampaign: liveCampaign
        ? {
            id: liveCampaign.id,
            status: liveCampaign.status,
            phase: liveCampaign.phase,
            round: liveCampaign.round,
            maxRounds: liveCampaign.maxRounds,
            redProgress: liveCampaign.redProgress,
            blueProgress: liveCampaign.blueProgress,
            redScore: liveCampaign.redScore,
            blueScore: liveCampaign.blueScore,
            winner: liveCampaign.winner,
            narrative: liveCampaign.narrative,
            startedAt: liveCampaign.startedAt,
            endedAt: liveCampaign.endedAt,
            scenario: {
              key: liveCampaign.scenario.key,
              codename: liveCampaign.scenario.codename,
              company: liveCampaign.scenario.company,
              industry: liveCampaign.scenario.industry,
              difficulty: liveCampaign.scenario.difficulty,
              redObjective: liveCampaign.scenario.redObjective,
              blueObjective: liveCampaign.scenario.blueObjective,
            },
          }
        : null,
      liveEvents,
      liveInfra,
      liveLab,
      recentActivity,
      knowledgeSpark,
      lab: {
        online: info.online,
        port: info.port,
        activeCampaigns: info.activeCampaigns,
        exchanges: info.exchanges,
      },
      knowledge: { red: redKnowledge, blue: blueKnowledge },
      stats: {
        totalCampaigns: completed.length,
        running: activeCampaign ? 1 : 0,
        redWins,
        blueWins,
        draws: completed.length - redWins - blueWins,
        knowledgeCount: knowledges.length,
        evolutionRed: clamp100(evolutionRed),
        evolutionBlue: clamp100(evolutionBlue),
      },
    })
  } catch (error) {
    console.error('[api/state] error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

function clamp100(v: number) {
  return Math.max(5, Math.min(100, v))
}
