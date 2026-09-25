import { NextRequest, NextResponse } from 'next/server'
import { startCampaign } from '@/lib/sim/engine'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// GET /api/campaigns — Archivo completo de campañas (hasta 500).
// El agregado /api/state solo devuelve las 15 más recientes;
// esta ruta alimenta /historial con filtros y exportación.
// ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const rows = await db.campaign.findMany({
      orderBy: { startedAt: 'desc' },
      take: 500,
      include: {
        scenario: {
          select: { codename: true, company: true, industry: true, difficulty: true },
        },
      },
    })

    const campaigns = rows.map((c) => ({
      id: c.id,
      status: c.status,
      winner: c.winner,
      redProgress: c.redProgress,
      blueProgress: c.blueProgress,
      redScore: c.redScore,
      blueScore: c.blueScore,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      scenario: c.scenario,
    }))

    return NextResponse.json({ ok: true, campaigns })
  } catch (error) {
    console.error('[api/campaigns] GET error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let scenarioId: string | undefined
    try {
      const body = (await req.json()) as { scenarioId?: string }
      scenarioId = body?.scenarioId
    } catch {
      // sin body → escenario aleatorio
    }

    const campaign = await startCampaign(scenarioId)
    return NextResponse.json({ ok: true, campaignId: campaign.id })
  } catch (error) {
    const err = error as Error & { code?: string }
    if (err.code === 'CAMPAIGN_RUNNING') {
      return NextResponse.json({ ok: false, error: 'Ya hay una campaña en curso' }, { status: 409 })
    }
    console.error('[api/campaigns] error:', err)
    return NextResponse.json({ ok: false, error: 'No se pudo iniciar la campaña' }, { status: 500 })
  }
}
