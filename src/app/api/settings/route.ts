import { NextRequest, NextResponse } from 'next/server'
import {
  getProviderConfig,
  saveProviderConfig,
  maskKey,
} from '@/lib/sim/provider-config'
import { classifyTarget, isLocalRequest } from '@/lib/net/target-guard'
import { isMutationAuthorized, isSameOrigin, readJsonBody, rateLimit, clientKey } from '@/lib/net/access'

export const dynamic = 'force-dynamic'

// Topes de tamaño para la config persistida (tabla Setting, String sin
// límite en SQLite — hallazgo Ronda 11 de bugs): sin ellos, un POST con
// cadenas enormes se archivaba íntegro y bloataba la BD y las respuestas.
const MAX_BASE_URL = 2048
const MAX_MODEL = 200
const MAX_API_KEY = 4096

export async function GET() {
  try {
    const cfg = await getProviderConfig()
    return NextResponse.json({
      ok: true,
      source: cfg.source,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      apiKeyMasked: maskKey(cfg.apiKey),
      hasApiKey: cfg.apiKey.length > 0,
    })
  } catch (error) {
    console.error('[api/settings] GET error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // CSRF (hallazgo Ronda 12 de bugs): en modo local abierto, un POST
    // cross-site text/plain sin preflight podía redirigir el proveedor LLM
    // a un proxy propio (la API key se enviaría al siguiente uso del motor).
    if (!isSameOrigin(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'Origen cruzado no permitido en mutaciones' },
        { status: 403 }
      )
    }
    // Tope de cuerpo pre-parse (hallazgo Ronda 12): los topes de campo
    // (413 abajo) actúan DESPUÉS de parsear — sin este control, un cuerpo
    // de cientos de MB se parseaba íntegro en memoria. 16 KB cubre con
    // holgura los máximos de baseUrl+apiKey+model. readJsonBody acota
    // TAMBIÉN las peticiones chunked sin Content-Length (tarea
    // cuerpo-chunked del ROADMAP), leyendo el stream con tope.
    const parsed = await readJsonBody<{ baseUrl?: string; apiKey?: string; model?: string }>(req, 16384)
    if (!parsed.ok) {
      const tooLarge = parsed.reason === 'too-large'
      return NextResponse.json(
        { ok: false, error: tooLarge ? 'Cuerpo demasiado grande' : 'Cuerpo JSON inválido' },
        { status: tooLarge ? 413 : 400 }
      )
    }
    const body = parsed.body
    // Rate limit ANTES de la verificación del token (hallazgo Ronda 11):
    // con ADMIN_TOKEN definido, este endpoint era el único de mutación sin
    // límite — un atacante podía probar tokens sin techo. 30/min es
    // holgado para uso legítimo y acota la fuerza bruta a 30 intentos/min.
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
    if (!body.baseUrl || !body.model) {
      return NextResponse.json(
        { ok: false, error: 'baseUrl y model son obligatorios' },
        { status: 400 }
      )
    }
    if (
      body.baseUrl.length > MAX_BASE_URL ||
      body.model.length > MAX_MODEL ||
      (body.apiKey !== undefined && body.apiKey.length > MAX_API_KEY)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Algún campo excede el tamaño máximo permitido' },
        { status: 413 }
      )
    }

    let url: URL
    try {
      url = new URL(body.baseUrl)
    } catch {
      return NextResponse.json({ ok: false, error: 'Base URL inválida' }, { status: 400 })
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return NextResponse.json({ ok: false, error: 'El protocolo debe ser http(s)' }, { status: 400 })
    }

    // ── Guard SSRF (protocolo §6: todo fetch a URL de usuario pasa por el
    // guard) ── La baseUrl se PERSISTE y luego el MOTOR hace POST
    // {baseUrl}/chat/completions. Sin este control, una conexión remota
    // podría dejar apuntando el servidor a metadata de nube o a la red
    // interna. Política idéntica a /api/models.
    const local = isLocalRequest(req.headers)
    if (!local && url.protocol !== 'https:') {
      return NextResponse.json(
        { ok: false, error: 'Desde una conexión remota el proveedor debe usar https' },
        { status: 400 }
      )
    }
    const target = await classifyTarget(url.hostname)
    if (target === 'metadata') {
      return NextResponse.json(
        { ok: false, error: 'Destino bloqueado: endpoint de metadata de nube' },
        { status: 403 }
      )
    }
    if (target === 'private' && !local) {
      return NextResponse.json(
        { ok: false, error: 'Destino bloqueado: no se permite alcanzar redes internas desde una conexión remota' },
        { status: 403 }
      )
    }

    const cfg = await saveProviderConfig({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
    })

    return NextResponse.json({
      ok: true,
      source: cfg.source,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      apiKeyMasked: maskKey(cfg.apiKey),
      hasApiKey: cfg.apiKey.length > 0,
    })
  } catch (error) {
    console.error('[api/settings] POST error:', error)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
