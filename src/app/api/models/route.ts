import { NextRequest, NextResponse } from 'next/server'
import { getProviderConfig } from '@/lib/sim/provider-config'
import { classifyTarget, isLocalRequest } from '@/lib/net/target-guard'
import { SafeFetchError, safeFetch } from '@/lib/net/safe-fetch'
import { isMutationAuthorized, isSameOrigin, readJsonBody, rateLimit, clientKey } from '@/lib/net/access'

export const dynamic = 'force-dynamic'

interface RawModel {
  id?: string
  name?: string
  owned_by?: string
  owned_by_endpoints?: unknown
}

/**
 * POST /api/models — "Descargar modelos"
 * Consulta GET {baseUrl}/models del proveedor compatible OpenAI y
 * devuelve el catálogo disponible para seleccionar en la UI.
 * Si no se envían baseUrl/apiKey usa los guardados (BD → env).
 */
export async function POST(req: NextRequest) {
  try {
    // CSRF (hallazgo Ronda 12 de bugs): primera barrera, idéntica al resto
    // de mutaciones (settings, campaigns, autopilot).
    if (!isSameOrigin(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'Origen cruzado no permitido en mutaciones' },
        { status: 403 }
      )
    }
    // Rate limit antes de la verificación del token (hallazgo Ronda 11:
    // fuerza bruta de ADMIN_TOKEN sin techo en este endpoint). Mismo
    // bucket `admin:` que /api/settings — los intentos se comparten.
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
    // Tope de cuerpo pre-parse (hallazgo Ronda 12), tras el 401: el orden
    // canónico de barreras es 403→429→401→413 (tarea endurecimiento-hd, HD4)
    // — antes el cuerpo se parseaba antes del 429/401. 16 KB holgados para
    // baseUrl + apiKey. readJsonBody acota TAMBIÉN las peticiones chunked
    // sin Content-Length (tarea cuerpo-chunked del ROADMAP), leyendo el
    // stream con tope. JSON inválido → {} como antes (campos opcionales).
    const parsed = await readJsonBody<{ baseUrl?: string; apiKey?: string }>(req, 16384)
    if (!parsed.ok && parsed.reason === 'too-large') {
      return NextResponse.json({ ok: false, error: 'Cuerpo demasiado grande' }, { status: 413 })
    }
    const body = parsed.ok ? parsed.body : {}
    let baseUrl = body.baseUrl?.replace(/\/$/, '')
    let apiKey = body.apiKey

    if (!baseUrl || !apiKey) {
      const cfg = await getProviderConfig()
      if (cfg.source !== 'zai') {
        baseUrl = baseUrl || cfg.baseUrl
        apiKey = apiKey || cfg.apiKey
      }
    }

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Introduce la Base URL y la API key del proveedor primero' },
        { status: 400 }
      )
    }

    let url: URL
    try {
      url = new URL(baseUrl)
    } catch {
      return NextResponse.json({ ok: false, error: 'Base URL inválida' }, { status: 400 })
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return NextResponse.json({ ok: false, error: 'El protocolo debe ser http(s)' }, { status: 400 })
    }

    // ── Guard SSRF: el servidor no es un proxy hacia redes internas ──
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

    // ── Fetch con pin de IP (tarea ssrf-ip-pinning) ── Las pre-barreras de
    // arriba fijan la política con mensajes 400/403 precisos; safeFetch es el
    // punto de CUMPLIMIENTO: resuelve UNA vez, reclasifica ese mismo lote y
    // conecta a esa IP exacta (el fetch histórico re-resolvía DNS y un
    // rebinding podía colar otra IP en la conexión). Política: los privados
    // solo desde petición local, los públicos en cualquier caso; metadata
    // queda bloqueada SIEMPRE dentro de safeFetch.
    const res = await safeFetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs: 15000,
      allowedKinds: local ? ['private', 'public'] : ['public'],
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json(
        {
          ok: false,
          error: `El proveedor respondió ${res.status}. Revisa la URL y la API key.`,
          detail: detail.slice(0, 300) || undefined,
        },
        { status: 502 }
      )
    }

    const data = (await res.json()) as { data?: RawModel[]; models?: RawModel[] }
    const rawList = data.data ?? data.models ?? []

    const models = rawList
      .map((m) => ({
        id: (m.id ?? m.name ?? '').toString(),
        owner: (m.owned_by ?? 'provider').toString(),
      }))
      .filter((m) => m.id.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ ok: true, count: models.length, models })
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError' || (error instanceof SafeFetchError && error.code === 'timeout'))
    const msg = timedOut
      ? 'Tiempo de espera agotado al contactar con el proveedor'
      : 'No se pudo conectar con el proveedor'
    console.error('[api/models] error:', error)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
