import { NextRequest, NextResponse } from 'next/server'
import {
  getProviderConfig,
  saveProviderConfig,
  maskKey,
} from '@/lib/sim/provider-config'

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
