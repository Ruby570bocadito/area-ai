import { NextRequest, NextResponse } from 'next/server'
import { getAutopilot, setAutopilot } from '@/lib/sim/autopilot'
import {
  isMutationAuthorized,
  isSameOrigin,
  readJsonBody,
  rateLimit,
  clientKey,
} from '@/lib/net/access'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ ok: true, enabled: await getAutopilot() })
  } catch (error) {
    console.error('[api/autopilot] GET:', error)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // CSRF (hallazgo Ronda 12 de bugs): en modo local abierto, un POST
    // cross-site text/plain sin preflight activaba el modo continuo
    // (gasto LLM en bucle). Primera barrera de la ruta.
    if (!isSameOrigin(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'Origen cruzado no permitido en mutaciones' },
        { status: 403 }
      )
    }
    // Rate limit antes de la verificación del token (hallazgo Ronda 12:
    // este endpoint acreditaba ADMIN_TOKEN sin techo — bugs-11 M1 cubrió
    // settings/models y pasó por alto el autopiloto). Mismo bucket `admin:`.
    if (!rateLimit(`admin:${clientKey(req.headers)}`, 30)) {
      return NextResponse.json(
        { ok: false, error: 'Demasiados intentos; espera un momento antes de reintentar' },
        { status: 429 }
      )
    }
    if (!isMutationAuthorized(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado: falta el token de administración (X-Admin-Token)' },
        { status: 401 }
      )
    }
    // Tope de cuerpo pre-parse (hallazgo Ronda 12): el payload legítimo es
    // un booleano JSON; cualquier cuerpo mayor se rechaza antes de parsear.
    // readJsonBody acota TAMBIÉN las peticiones chunked sin Content-Length
    // (tarea cuerpo-chunked del ROADMAP), leyendo el stream con tope.
    const parsed = await readJsonBody<{ enabled?: unknown }>(req, 1024)
    if (!parsed.ok) {
      const status = parsed.reason === 'too-large' ? 413 : 400
      return NextResponse.json({ ok: false, error: parsed.reason === 'too-large' ? 'Cuerpo demasiado grande' : 'Cuerpo JSON inválido' }, { status })
    }
    const body = parsed.body
    // Coerción estricta (hallazgo Ronda 12): Boolean('false') era true —
    // la cadena "false" ACTIVABA el modo continuo. La UI envía booleanos
    // reales, así que solo el literal true activa.
    const enabled = await setAutopilot(body?.enabled === true)
    return NextResponse.json({ ok: true, enabled })
  } catch (error) {
    console.error('[api/autopilot] POST:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cambiar el modo de operación' }, { status: 500 })
  }
}
