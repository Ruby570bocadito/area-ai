import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// GET /api/knowledge — Memoria completa del sistema (hasta 1000
// lecciones) con la campaña de origen. /api/state solo devuelve
// el top-24 por equipo; esta ruta alimenta /conocimiento con
// búsqueda, filtros y ordenación sobre TODA la memoria.
// ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const rows = await db.knowledge.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        campaign: { include: { scenario: { select: { codename: true } } } },
      },
    })

    const knowledge = rows.map((k) => ({
      id: k.id,
      team: k.team as 'RED' | 'BLUE',
      campaignId: k.campaignId,
      agentCodename: k.agentCodename,
      category: k.category,
      title: k.title,
      content: k.content,
      tags: k.tags,
      confidence: k.confidence,
      timesUsed: k.timesUsed,
      timesWorked: k.timesWorked,
      createdAt: k.createdAt,
      campaignCodename: k.campaign?.scenario?.codename ?? null,
    }))

    return NextResponse.json({ ok: true, knowledge })
  } catch (error) {
    console.error('[api/knowledge] error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
