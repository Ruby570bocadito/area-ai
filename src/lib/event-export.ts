import { csvEscapeCell } from '@/lib/text'
import type { CampaignDetailResponse, EventDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Exportación de la telemetría de eventos de una campaña
// (CSV + JSON) desde la ficha /historial/[id].
//
// Módulo puro (sin React ni DOM), patrón knowledge-export.ts /
// aggregate-report.ts: la generación completa es testeable de forma
// unitaria (tests/event-export.test.ts) y el componente solo hace el
// transporte al usuario (descarga).
//
// Motivación (backlog #2 de implementaciones-12): la ficha muestra
// la telemetría íntegra (comandos reales, evidencia HTTP, impactos)
// pero no permitía llevársela — el informe agregado del historial y
// la memoria del conocimiento sí exportaban. Con este módulo los
// tres activos de datos del producto tienen vía de salida, todos
// con el MISMO dialecto: BOM UTF-8, separador «;» (locale es-ES) y
// escapado RFC 4180 vía csvEscapeCell (src/lib/text.ts, fuente única
// compartida — la neutralización de fórmulas CSV propuesta por
// bugs-14 en HD2, cuando se adopte, cubrirá también este exportador
// automáticamente al vivir en la fuente).
//
// El JSON conserva el detalle íntegro (evidencia y comandos incluidos)
// más los metadatos de la campaña — pensado para análisis post-campaña
// o reimportación sin depender del aplanado del CSV.
// ─────────────────────────────────────────────────────────────

/** Cabeceras del CSV de telemetría (orden fijo, contrato por tests). */
export const EVENTS_CSV_HEADERS = [
  'Seq',
  'Ronda',
  'Fase',
  'Equipo',
  'Agente',
  'Acción',
  'Resultado',
  'Impacto',
  'Severidad',
  'Nodo',
  'Comando',
  'Detalle',
]

/** Etiqueta legible del agente (los eventos SYSTEM no tienen). */
function agentLabel(e: EventDTO): string {
  return e.agentCodename ?? ''
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const time = new Date(d).getTime()
  return Number.isFinite(time) ? new Date(d).toLocaleString('es-ES') : ''
}

/**
 * CSV de la telemetría: cabecera + una fila por evento, en el orden
 * dado (la ficha sirve los eventos por seq ascendente — orden
 * cronológico de ejecución). Con lista vacía devuelve BOM + cabecera.
 * Los eventos SYSTEM (inicio y fin de campaña) se incluyen: son parte
 * de la telemetría y aportan la narrativa del arranque y el cierre.
 */
export function buildEventsCsv(events: EventDTO[]): string {
  const rows = events.map((e) => [
    e.seq,
    e.round,
    e.phase,
    e.team,
    agentLabel(e),
    e.action,
    e.result ?? '',
    e.impact,
    e.severity ?? 'INFO',
    e.targetNode ?? '',
    e.command ?? '',
    e.detail,
  ])
  return (
    '\uFEFF' +
    [EVENTS_CSV_HEADERS, ...rows]
      .map((row) => row.map((cell) => csvEscapeCell(cell as string | number)).join(';'))
      .join('\n')
  )
}

/**
 * JSON de la telemetría con metadatos de la campaña. Los eventos van
 * íntegros (evidencia y comandos parseables como strings — la evidencia
 * en la BD es JSON serializado y se conserva tal cual para no romper
 * campos que no controlamos), la marca temporal va en ISO-8601 y los
 * campos de escenario identificador (codename, empresa, industria y
 * objetivos) van subidos para que el fichero se entienda sin la app.
 */
export function buildEventsJson(detail: CampaignDetailResponse, now: Date = new Date()): string {
  const { campaign, events } = detail
  return JSON.stringify(
    {
      ok: true,
      exportedAt: now.toISOString(),
      campaign: {
        id: campaign.id,
        codename: campaign.scenario.codename,
        company: campaign.scenario.company,
        industry: campaign.scenario.industry,
        difficulty: campaign.scenario.difficulty,
        redObjective: campaign.scenario.redObjective,
        blueObjective: campaign.scenario.blueObjective,
        status: campaign.status,
        winner: campaign.winner,
        redProgress: campaign.redProgress,
        blueProgress: campaign.blueProgress,
        redScore: campaign.redScore,
        blueScore: campaign.blueScore,
        round: campaign.round,
        maxRounds: campaign.maxRounds,
        engineMode: campaign.engineMode,
        startedAt: campaign.startedAt,
        endedAt: campaign.endedAt,
        startedAtLabel: formatDate(campaign.startedAt),
        endedAtLabel: formatDate(campaign.endedAt),
      },
      total: events.length,
      events,
    },
    null,
    2
  )
}
