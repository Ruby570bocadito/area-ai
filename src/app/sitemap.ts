import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────
// Sitemap (backlog 14h39 #7 — SEO menor, Ronda 8).
//
// Rutas estáticas del producto + fichas dinámicas de campaña
// (/historial/[id], solo COMPLETED: son las únicas con contenido
// estable para un indexador). Lectura en petición (force-dynamic)
// para no acoplar el build de producción al estado de la BD; si
// la BD no responde, el sitemap degrada a las rutas estáticas.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Rutas estáticas: panel, arena en vivo, conocimiento, archivo, analítica y modelos. */
const STATIC_ROUTES = ['', '/arena', '/conocimiento', '/historial', '/analitica', '/modelos'] as const

/** Tope de fichas dinámicas (mismo orden de magnitud que la condición de paginación D14 #2). */
const MAX_CAMPAIGN_URLS = 500

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: 'daily',
    priority: route === '' ? 1 : 0.7,
  }))

  let campaigns: { id: string; startedAt: Date; endedAt: Date | null }[] = []
  try {
    campaigns = await db.campaign.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      take: MAX_CAMPAIGN_URLS,
      select: { id: true, startedAt: true, endedAt: true },
    })
  } catch {
    // Sitemap parcial: las rutas estáticas no dependen de la BD.
  }

  const campaignEntries: MetadataRoute.Sitemap = campaigns.map((c) => ({
    url: `${SITE_URL}/historial/${c.id}`,
    lastModified: c.endedAt ?? c.startedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...staticEntries, ...campaignEntries]
}
