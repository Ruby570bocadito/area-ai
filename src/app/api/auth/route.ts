import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_MAX_AGE_S,
  ADMIN_TOKEN_COOKIE,
  adminTokenMatches,
  isSameOrigin,
  rateLimit,
  clientKey,
  readJsonBody,
} from '@/lib/net/access'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// POST /api/auth — Login del administrador (tarea
// cookie-admin-httponly del ROADMAP).
//
// Con ADMIN_TOKEN definido, las mutaciones aceptan el token vía
// cabecera X-Admin-Token o cookie `admin_token`. Hasta ahora la
// única forma de usar la cookie era escribirla a mano con
// `document.cookie` (recomendación del README), lo que obliga a
// exponer el token a JavaScript de la página. Este endpoint lo
// fija el SERVIDOR con los atributos correctos:
//
//   · HttpOnly        → JavaScript no puede leerlo (XSS no roba el token).
//   · SameSite=Strict → nunca se envía en navegaciones cruzadas.
//   · Secure          → solo cuando la petición llegó por https
//                       (X-Forwarded-Proto, como fija el Caddyfile),
//                       para no romper el uso local en http.
//   · Path=/          → cubre todas las rutas de mutación.
//   · Max-Age 12 h    → sesión acotada.
//
// DELETE /api/auth — Logout: expira la cookie en el cliente.
//
// El rate limit comparte el bucket `admin:` (30/min) con el resto
// de endpoints que acreditan el token: el login es exactamente el
// punto donde la fuerza bruta debe frenarse.
// ─────────────────────────────────────────────────────────────

function requestIsHttps(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto')
  if (proto) return proto.split(',')[0].trim() === 'https'
  try {
    return new URL(req.url).protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // CSRF: el login es una mutación (fija credencial) → misma primera barrera.
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json(
      { ok: false, error: 'Origen cruzado no permitido en mutaciones' },
      { status: 403 }
    )
  }
  // Fuerza bruta del token: mismo bucket `admin:` que settings/models/autopilot.
  if (!rateLimit(`admin:${clientKey(req.headers)}`, 30)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos; espera un momento antes de reintentar' },
      { status: 429 }
    )
  }
  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'La app está en modo local abierto (sin ADMIN_TOKEN): no hay nada que acreditar' },
      { status: 400 }
    )
  }
  // Tope de cuerpo con tope de stream (payload legítimo: { token } corto).
  const parsed = await readJsonBody<{ token?: unknown }>(req, 1024)
  if (!parsed.ok) {
    const tooLarge = parsed.reason === 'too-large'
    return NextResponse.json(
      { ok: false, error: tooLarge ? 'Cuerpo demasiado grande' : 'Cuerpo JSON inválido' },
      { status: tooLarge ? 413 : 400 }
    )
  }
  const provided = typeof parsed.body?.token === 'string' ? parsed.body.token : ''
  // Mensaje idéntico para token ausente e incorrecto: sin oráculo de existencia.
  if (!provided || !adminTokenMatches(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'Token no válido' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_TOKEN_COOKIE, provided, {
    httpOnly: true,
    sameSite: 'strict',
    secure: requestIsHttps(req),
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE_S,
  })
  return res
}

export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json(
      { ok: false, error: 'Origen cruzado no permitido en mutaciones' },
      { status: 403 }
    )
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_TOKEN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: requestIsHttps(req),
    path: '/',
    maxAge: 0,
  })
  return res
}
