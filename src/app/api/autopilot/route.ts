import { NextResponse } from 'next/server'
import { getAutopilot, setAutopilot } from '@/lib/sim/autopilot'
import { isMutationAuthorized } from '@/lib/net/access'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ ok: true, enabled: await getAutopilot() })
  } catch (error) {
    console.error('[api/autopilot] GET:', error)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!isMutationAuthorized(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado: falta el token de administración (X-Admin-Token)' },
        { status: 401 }
      )
    }
    const body = (await req.json().catch(() => ({}))) as { enabled?: boolean }
    const enabled = await setAutopilot(Boolean(body.enabled))
    return NextResponse.json({ ok: true, enabled })
  } catch (error) {
    console.error('[api/autopilot] POST:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cambiar el modo de operación' }, { status: 500 })
  }
}
