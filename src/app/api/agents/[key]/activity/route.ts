import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Actividad REAL de un agente, agregada desde la base de datos:
// historial de acciones, técnicas usadas, objetivos atacados y
// rendimiento por fase. Todo procede de CampaignEvent reales.
// ─────────────────────────────────────────────────────────────

const RED_OK = new Set(['EXITO', 'PARCIAL'])
const BLUE_OK = new Set(['BLOQUEADO', 'DETECTADO', 'CONTENIDO'])

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  try {
    const agent = await db.agent.findUnique({ where: { key } })
    if (!agent) {
      return NextResponse.json({ ok: false, error: 'Agente no encontrado' }, { status: 404 })
    }

    const events = await db.campaignEvent.findMany({
      where: { agentKey: key },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { campaign: { select: { scenario: { select: { codename: true, key: true } } } } },
    })

    const isRed = agent.team === 'RED'
    const total = events.length
    const succeeded = events.filter((e) =>
      isRed ? RED_OK.has(e.result ?? '') : BLUE_OK.has(e.result ?? '')
    ).length

    const bump = (map: Map<string, number>, k: string) => map.set(k, (map.get(k) ?? 0) + 1)

    const techniques = new Map<string, number>()
    const targets = new Map<string, number>()
    const byPhase = new Map<string, { total: number; success: number }>()

    for (const e of events) {
      bump(techniques, e.action)
      if (e.targetNode) bump(targets, e.targetNode)
      const ph = byPhase.get(e.phase) ?? { total: 0, success: 0 }
      ph.total += 1
      if (isRed ? RED_OK.has(e.result ?? '') : BLUE_OK.has(e.result ?? '')) ph.success += 1
      byPhase.set(e.phase, ph)
    }

    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }))

    return NextResponse.json({
      ok: true,
      agent: { key: agent.key, codename: agent.codename, team: agent.team },
      summary: {
        totalActions: total,
        successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
        techniques: top(techniques, 6),
        targets: top(targets, 5),
        byPhase: [...byPhase.entries()].map(([phase, v]) => ({ phase, ...v })),
      },
      events: events.map((e) => ({
        id: e.id,
        seq: e.seq,
        round: e.round,
        phase: e.phase,
        team: e.team as 'RED' | 'BLUE' | 'SYSTEM',
        agentKey: e.agentKey,
        agentCodename: e.agentCodename,
        action: e.action,
        detail: e.detail,
        result: e.result,
        impact: e.impact,
        severity: e.severity,
        targetNode: e.targetNode,
        createdAt: e.createdAt,
        campaignCodename: e.campaign?.scenario?.codename ?? '—',
      })),
    })
  } catch (error) {
    console.error('[api/agents/activity] error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
