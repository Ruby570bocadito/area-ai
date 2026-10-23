import { NextRequest, NextResponse } from 'next/server'
import { startCampaign } from '@/lib/sim/engine'
import { db } from '@/lib/db'
import {
  isMutationAuthorized,
  isSameOrigin,
  readJsonBody,
  rateLimit,
  clientKey,
} from '@/lib/net/access'

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
    // CSRF (hallazgo Ronda 12 de bugs): en modo local abierto, un POST
    // cross-site text/plain sin preflight lanzaba campañas (gasto LLM).
    if (!isSameOrigin(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'Origen cruzado no permitido en mutaciones' },
        { status: 403 }
      )
    }
    // Tope de cuerpo pre-parse (hallazgo Ronda 12): el payload legítimo es
    // { scenarioId } — 4 KB es un orden de magnitud holgado. readJsonBody
    // acota TAMBIÉN las peticiones chunked sin Content-Length (tarea
    // cuerpo-chunked del ROADMAP), leyendo el stream con tope.
    const parsed = await readJsonBody<{ scenarioId?: string }>(req, 4096)
    if (!parsed.ok) {
      if (parsed.reason === 'too-large') {
        return NextResponse.json({ ok: false, error: 'Cuerpo demasiado grande' }, { status: 413 })
      }
      // sin cuerpo o JSON inválido → escenario aleatorio (comportamiento previo)
    }
    if (!isMutationAuthorized(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado: falta el token de administración (X-Admin-Token)' },
        { status: 401 }
      )
    }
    const key = clientKey(req.headers)
    if (!rateLimit(`campaigns:${key}`)) {
      return NextResponse.json(
        { ok: false, error: 'Demasiadas campañas lanzadas; espera un momento antes de reintentar' },
        { status: 429 }
      )
    }

    const scenarioId = parsed.ok ? parsed.body?.scenarioId : undefined

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
