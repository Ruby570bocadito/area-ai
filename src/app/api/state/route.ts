import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/sim/seed'
import { recoverOrphanCampaigns } from '@/lib/sim/engine'
import { getAutopilot, maybeRunAutopilot } from '@/lib/sim/autopilot'
import { llmProviderName } from '@/lib/sim/llm'
import type { Infrastructure } from '@/lib/sim/types'

export const dynamic = 'force-dynamic'

function knowledgeScore(k: { confidence: number; timesUsed: number; timesWorked: number }) {
  const ratio = k.timesUsed > 0 ? k.timesWorked / k.timesUsed : 0.5
  return k.confidence * 0.6 + ratio * 0.3 + Math.min(1, k.timesUsed / 10) * 0.1
}

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
    const liveInfra: Infrastructure | null = liveCampaign
      ? JSON.parse(liveCampaign.scenario.infrastructure)
      : null

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
