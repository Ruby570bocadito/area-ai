import { NextRequest, NextResponse } from 'next/server'
import { startCampaign } from '@/lib/sim/engine'

export const dynamic = 'force-dynamic'

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
