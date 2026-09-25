import { csvEscapeCell } from '@/lib/text'
import type { KnowledgeListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Exportación de la memoria del conocimiento (CSV + JSON).
//
// Módulo puro (sin React ni DOM), patrón aggregate-report.ts /
// text.ts: la generación completa es testeable de forma unitaria
// (tests/knowledge-export.test.ts) y el componente solo hace el
// transporte al usuario (descarga).
//
// El dialecto CSV es el MISMO que el del exportador de campañas de
// history-panel.tsx: BOM UTF-8 (para que Excel respete los acentos),
// separador «;» (locale es-ES) y escapado RFC 4180 vía csvEscapeCell
// (src/lib/text.ts, fuente única compartida).
//
// El JSON añade metadatos (instante, filtros y recuento por equipo)
// y normaliza los tags a lista — pensado para reimportar o analizar
// la memoria con herramientas externas sin depender del dialecto CSV.
// ─────────────────────────────────────────────────────────────

export type KnowledgeExportItem = Omit<KnowledgeListItemDTO, 'campaignCodename'> & {
  /**
   * El panel de conocimiento maneja un codename OPCIONAL (el sondeo
   * /api/state no lo trae; el endpoint completo sí), así que el
   * exportador acepta ambas formas — undefined y null son «sin campaña».
   */
  campaignCodename?: string | null
}

/** Etiquetas legibles de la taxonomía (espejo del panel y de la ficha). */
export const KNOWLEDGE_CATEGORY_LABEL: Record<string, string> = {
  TACTICA: 'Táctica',
  TECNICA: 'Técnica',
  DEFENSA: 'Defensa',
  VULNERABILIDAD: 'Vulnerabilidad',
  LECCION: 'Lección',
  INTELIGENCIA: 'Inteligencia',
}

export const KNOWLEDGE_CSV_HEADERS = [
  'Equipo',
  'Categoría',
  'Título',
  'Contenido',
  'Tags',
  'Confianza %',
  'Usos',
  'Éxitos',
  'Tasa de éxito %',
  'Agente',
  'Campaña origen',
  'Creada',
]

/** Tasa de éxito en % entero, o null si la lección no se ha usado nunca. */
function successRate(k: KnowledgeExportItem): number | null {
  return k.timesUsed > 0 ? Math.round((k.timesWorked / k.timesUsed) * 100) : null
}

function formatDate(d: string): string {
  const time = new Date(d).getTime()
  return Number.isFinite(time) ? new Date(d).toLocaleString('es-ES') : ''
}

/**
 * CSV de la memoria: cabecera + una fila por lección, en el orden dado
 * (el llamante decide el orden — el panel exporta su selección ya
 * filtrada y ordenada). Con memoria vacía devuelve BOM + cabecera.
 */
export function buildKnowledgeCsv(items: KnowledgeExportItem[]): string {
  const rows = items.map((k) => {
    const rate = successRate(k)
    return [
      k.team,
      KNOWLEDGE_CATEGORY_LABEL[k.category] ?? k.category,
      k.title,
      k.content,
      k.tags,
      Math.round(k.confidence * 100),
      k.timesUsed,
      k.timesWorked,
      rate ?? '',
      k.agentCodename ?? '',
      k.campaignCodename ?? '',
      formatDate(k.createdAt),
    ]
  })
  return (
    '\uFEFF' +
    [KNOWLEDGE_CSV_HEADERS, ...rows]
      .map((row) => row.map((cell) => csvEscapeCell(cell as string | number)).join(';'))
      .join('\n')
  )
}

export interface KnowledgeJsonMeta {
  /** Descripción legible de los filtros activos en el panel. */
  filtersDesc: string
  /** Lecciones RED incluidas en la selección. */
  red: number
  /** Lecciones BLUE incluidas en la selección. */
  blue: number
}

/**
 * JSON de la memoria con metadatos de exportación. Los tags se
 * normalizan a lista de tokens no vacíos (el formato BD es «a,b»),
 * la confianza se redondea a 2 decimales y la tasa de éxito se
 * precalcula (null cuando no hay usos) para que el consumidor no
 * tenga que reimplementar la regla.
 */
export function buildKnowledgeJson(
  items: KnowledgeExportItem[],
  meta: KnowledgeJsonMeta,
  now: Date = new Date()
): string {
  return JSON.stringify(
    {
      ok: true,
      exportedAt: now.toISOString(),
      filters: meta.filtersDesc,
      total: items.length,
      red: meta.red,
      blue: meta.blue,
      lessons: items.map((k) => ({
        team: k.team,
        category: k.category,
        title: k.title,
        content: k.content,
        tags: k.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        confidence: Math.round(k.confidence * 100) / 100,
        timesUsed: k.timesUsed,
        timesWorked: k.timesWorked,
        successRate: successRate(k),
        agentCodename: k.agentCodename,
        campaignId: k.campaignId,
        campaignCodename: k.campaignCodename,
        createdAt: k.createdAt,
      })),
    },
    null,
    2
  )
}
