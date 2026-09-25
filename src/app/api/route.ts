import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// GET /api — Healthcheck del servicio. Sustituye al placeholder
// "Hello, world!" del scaffolding manteniendo compatibilidad con
// cualquier sondeo existente sobre esta ruta.
// ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    await db.setting.count() // ping barato a la BD
    return NextResponse.json({ ok: true, service: 'area-ai', db: 'up', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[api] healthcheck:', error)
    return NextResponse.json({ ok: false, service: 'area-ai', db: 'down' }, { status: 503 })
  }
}
