import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { CampaignSiblingDTO, EventDTO, InfraNodeDTO, KnowledgeDTO } from '@/lib/api-types'
import type { Infrastructure } from '@/lib/sim/types'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// GET /api/campaigns/[id] — Ficha completa de cualquier campaña
// del archivo: resultado, registro íntegro de eventos (con
// comandos reales y evidencia HTTP), lecciones archivadas por
// esta campaña, infraestructura del escenario para el mapa y
// las demás campañas del mismo escenario (comparativa).
// ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: { scenario: true },
    })
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    const [events, knowledge, siblings] = await Promise.all([
      db.campaignEvent.findMany({
        where: { campaignId: id },
        orderBy: { seq: 'asc' },
        take: 500,
      }),
      db.knowledge.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'asc' },
      }),
      // Otras campañas del mismo escenario para la comparativa de la ficha
      db.campaign.findMany({
        where: { scenarioId: campaign.scenarioId, id: { not: id } },
        orderBy: { startedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          winner: true,
          redProgress: true,
          blueProgress: true,
          redScore: true,
          blueScore: true,
          round: true,
          maxRounds: true,
          startedAt: true,
          endedAt: true,
        },
      }),
    ])

    let infra: { nodes: InfraNodeDTO[] } | null = null
    try {
      const parsed = JSON.parse(campaign.scenario.infrastructure) as Infrastructure
      if (Array.isArray(parsed?.nodes) && parsed.nodes.length > 0) infra = { nodes: parsed.nodes }
    } catch {
      infra = null
    }

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        status: campaign.status,
        phase: campaign.phase,
        round: campaign.round,
        maxRounds: campaign.maxRounds,
        redProgress: campaign.redProgress,
        blueProgress: campaign.blueProgress,
        redScore: campaign.redScore,
        blueScore: campaign.blueScore,
        winner: campaign.winner,
        narrative: campaign.narrative,
        engineMode: campaign.engineMode,
        startedAt: campaign.startedAt,
        endedAt: campaign.endedAt,
        scenario: {
          key: campaign.scenario.key,
          codename: campaign.scenario.codename,
          company: campaign.scenario.company,
          industry: campaign.scenario.industry,
          difficulty: campaign.scenario.difficulty,
          redObjective: campaign.scenario.redObjective,
          blueObjective: campaign.scenario.blueObjective,
        },
      },
      events: events as unknown as EventDTO[],
      knowledge: knowledge as unknown as KnowledgeDTO[],
      siblings: siblings as unknown as CampaignSiblingDTO[],
      infra,
    })
  } catch (error) {
    console.error('[api/campaigns/id] error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
