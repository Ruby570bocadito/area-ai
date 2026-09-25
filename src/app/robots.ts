import type { MetadataRoute } from 'next'

// ─────────────────────────────────────────────────────────────
// robots.txt (backlog 14h39 #7 — SEO menor, Ronda 8).
//
// Sustituye al estático public/robots.txt (los ficheros de public/
// prevalecen sobre las rutas de app en Next, y el estático no podía
// declarar el sitemap). Conserva la enumeración explícita de rastreadores
// del fichero original y añade la declaración del sitemap dinámico
// (src/app/sitemap.ts: rutas estáticas + fichas de campaña).
// ─────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'Twitterbot', allow: '/' },
      { userAgent: 'facebookexternalhit', allow: '/' },
      { userAgent: '*', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
