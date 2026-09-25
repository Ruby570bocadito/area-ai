import { NextRequest, NextResponse } from 'next/server'
import {
  getProviderConfig,
  saveProviderConfig,
  maskKey,
} from '@/lib/sim/provider-config'
import { classifyTarget, isLocalRequest } from '@/lib/net/target-guard'
import { isMutationAuthorized } from '@/lib/net/access'

export const dynamic = 'force-dynamic'

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
    if (!isMutationAuthorized(req.headers)) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado: falta el token de administración (X-Admin-Token)' },
        { status: 401 }
      )
    }
    const body = (await req.json()) as {
      baseUrl?: string
      apiKey?: string
      model?: string
    }

    if (!body.baseUrl || !body.model) {
      return NextResponse.json(
        { ok: false, error: 'baseUrl y model son obligatorios' },
        { status: 400 }
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
