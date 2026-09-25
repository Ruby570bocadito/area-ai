import { NextRequest, NextResponse } from 'next/server'
import { getProviderConfig } from '@/lib/sim/provider-config'
import { classifyTarget, isLocalRequest } from '@/lib/net/target-guard'

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
    const body = (await req.json().catch(() => ({}))) as {
      baseUrl?: string
      apiKey?: string
    }

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

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    clearTimeout(timer)

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
    const msg =
      error instanceof Error && error.name === 'AbortError'
        ? 'Tiempo de espera agotado al contactar con el proveedor'
        : 'No se pudo conectar con el proveedor'
    console.error('[api/models] error:', error)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
