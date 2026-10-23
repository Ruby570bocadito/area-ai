import { NextRequest, NextResponse } from 'next/server'
import { startCampaign, acceptSeed, acceptDeterminista, acceptAdaptativa } from '@/lib/sim/engine'
import { db } from '@/lib/db'
import {
  isMutationAuthorized,
  isSameOrigin,
  readJsonBody,
  rateLimit,
  clientKey,
} from '@/lib/net/access'
import {
  findLaunch,
  recordLaunch,
  resolveDedupeKey,
} from './idempotencia'

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
    // Rate limit ANTES de la verificación del token (tarea endurecimiento-hd
    // del ROADMAP, HD3): este era el único endpoint de mutación que comparaba
    // el token sin haber consumido antes el bucket `admin:` — un atacante
    // recibía 401 infinitos sin tope (oráculo de fuerza bruta de ADMIN_TOKEN).
    // Mismo bucket compartido que settings/models/autopilot/auth: 30/min.
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
    // { scenarioId } — 4 KB es un orden de magnitud holgado. readJsonBody
    // acota TAMBIÉN las peticiones chunked sin Content-Length (tarea
    // cuerpo-chunked del ROADMAP), leyendo el stream con tope. Tras el 401:
    // el orden canónico de barreras es 403→429→401→413 (HD4).
    const parsed = await readJsonBody<{ scenarioId?: string; seed?: unknown; determinista?: unknown; adaptativa?: unknown }>(req, 4096)
    if (!parsed.ok) {
      if (parsed.reason === 'too-large') {
        return NextResponse.json({ ok: false, error: 'Cuerpo demasiado grande' }, { status: 413 })
      }
      // H-004 (caso 2): un cuerpo que no parsea es un error del
      // cliente, no una petición de azar — 400. Antes degradaba a
      // escenario aleatorio EN SILENCIO. El azar sigue disponible y
      // explícito: sin cuerpo ({} del reader vacío), {} o
      // {scenarioId:'random'}. Orden canónico intacto: 413 aquí y 400
      // después de 403→429→401.
      return NextResponse.json({ ok: false, error: 'Cuerpo JSON inválido' }, { status: 400 })
    }
    // Cubo propio de lanzamientos (riesgo R4): tras acreditar al cliente,
    // acota el gasto LLM de campañas en bucle (6/min, más severo que el
    // bucket `admin:` compartido).
    const key = clientKey(req.headers)
    if (!rateLimit(`campaigns:${key}`)) {
      return NextResponse.json(
        { ok: false, error: 'Demasiadas campañas lanzadas; espera un momento antes de reintentar' },
        { status: 429 }
      )
    }

    // Tras el 400 de arriba, parsed.ok está garantizado: el sin cuerpo
    // de readJsonBody ya llega como { ok: true, body: {} }.
    const scenarioId = parsed.body?.scenarioId

    // Semilla opcional (seed-determinista): entero [0, 2^31-1] para
    // reproducir una campaña idéntica en modo determinista. Si el
    // cliente la envía inválida se rechaza con 400 — NO se silencia
    // (pedir una semilla concreta y obtener otra al azar es una
    // promesa rota; validación de entradas, H-004).
    let seed: number | undefined
    if (parsed.ok && parsed.body?.seed !== undefined) {
      const semilla = acceptSeed(parsed.body.seed)
      if (semilla === null) {
        return NextResponse.json(
          { ok: false, error: 'Semilla inválida: debe ser un entero entre 0 y 2147483647' },
          { status: 400 }
        )
      }
      seed = semilla
    }

    // Interruptor determinista (seed-determinista): fuerza SIM aunque
    // haya proveedor — es lo que hace la reproducción OPERATIVA (con
    // LLM las decisiones del proveedor no son reproducibles).
    let determinista: boolean | undefined
    if (parsed.ok && parsed.body?.determinista !== undefined) {
      const forzado = acceptDeterminista(parsed.body.determinista)
      if (forzado === null) {
        return NextResponse.json(
          { ok: false, error: 'determinista inválido: debe ser un booleano' },
          { status: 400 }
        )
      }
      determinista = forzado
    }

    // Interruptor de dificultad adaptativa (dificultad-adaptativa):
    // activa por defecto; {adaptativa:false} lanza la campaña con la
    // fuerza defensiva neutra. El booleano inválido se rechaza con 400
    // (mismo criterio que seed/determinista — no se silencia). Nota:
    // en modo determinista queda neutra de serie — la reproducibilidad
    // exacta no admite parámetros dependientes del archivo al lanzar;
    // la respuesta devuelve el ajuste EFECTIVO congelado en la fila.
    let adaptativa: boolean | undefined
    if (parsed.ok && parsed.body?.adaptativa !== undefined) {
      const cambio = acceptAdaptativa(parsed.body.adaptativa)
      if (cambio === null) {
        return NextResponse.json(
          { ok: false, error: 'adaptativa inválida: debe ser un booleano' },
          { status: 400 }
        )
      }
      adaptativa = cambio
    }

    // Dedupe en servidor (idempotencia-lanzamiento: el cerrojo de
    // confirmacion-lanzamiento es solo cliente). Con Idempotency-Key
    // el replay dura 10 min; sin ella, el cuerpo idéntico se deduplica
    // en ventana corta (5 s, escala del doble clic). El replay devuelve
    // la respuesta original SIN consumir cuota de rate-limit: es el
    // mismo lanzamiento lógico, no uno nuevo.
    const dedupeKey = resolveDedupeKey(req.headers, parsed.ok ? parsed.body : undefined)
    if (dedupeKey) {
      const replay = findLaunch(dedupeKey)
      if (replay) {
        return NextResponse.json(replay.body, {
          status: replay.status,
          headers: { 'Idempotency-Replay': 'true' },
        })
      }
    }

    const campaign = await startCampaign(scenarioId, seed, determinista, adaptativa)
    const respuesta = { ok: true, campaignId: campaign.id, seed: campaign.seed, determinista: campaign.determinista, adaptativa: campaign.adaptativa, ajusteDefensa: campaign.ajusteDefensa }
    if (dedupeKey) recordLaunch(dedupeKey, 200, respuesta)
    return NextResponse.json(respuesta)
  } catch (error) {
    const err = error as Error & { code?: string }
    if (err.code === 'CAMPAIGN_RUNNING') {
      return NextResponse.json({ ok: false, error: 'Ya hay una campaña en curso' }, { status: 409 })
    }
    // H-004 (caso 1): el escenario pedido no existe — 400 con el id
    // recibido (truncado por resolverEscenario) para que el despistado
    // VEA qué id llegó mal copiado. Nada se lanzó: el rechazo ocurre
    // antes del create, sin fila ni bucle en segundo plano.
    if (err.code === 'SCENARIO_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
    }
    console.error('[api/campaigns] error:', err)
    return NextResponse.json({ ok: false, error: 'No se pudo iniciar la campaña' }, { status: 500 })
  }
}
