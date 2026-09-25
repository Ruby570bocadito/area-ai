'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Download,
  FileText,
  History,
  Hourglass,
  Info,
  Minus,
  Search,
  ShieldCheck,
  Swords,
} from 'lucide-react'
import { normalizeText } from '@/lib/text'
import { decisiveProgressLabel, VICTORY_RULE_DETAIL, VICTORY_RULE_SHORT } from '@/lib/victory'
import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Archivo completo de enfrentamientos: búsqueda, filtro por
// resultado y escenario, exportación CSV, informe agregado en
// Markdown y acceso a la ficha completa de cada campaña
// (/historial/[id]).
// ─────────────────────────────────────────────────────────────

type ResultFilter = 'ALL' | 'RED' | 'BLUE' | 'DRAW' | 'RUNNING'

export type { ResultFilter }

const RESULT_FILTERS: Array<{ key: ResultFilter; label: string }> = [
  { key: 'ALL', label: 'Todas' },
  { key: 'RED', label: 'Gana RED' },
  { key: 'BLUE', label: 'Gana BLUE' },
  { key: 'DRAW', label: 'Empates' },
  { key: 'RUNNING', label: 'En curso' },
]

const RESULT_FILTER_DESC: Record<ResultFilter, string> = {
  ALL: 'todas',
  RED: 'solo victorias RED',
  BLUE: 'solo victorias BLUE',
  DRAW: 'solo empates',
  RUNNING: 'solo en curso',
}

// La regla de victoria y sus textos viven en src/lib/victory.ts (fuente única
// compartida con el banner de resolución y el toast de fin de campaña).
function WinnerBadge({ winner, redProgress, blueProgress }: { winner: string | null; redProgress: number; blueProgress: number }) {
  const title = `${VICTORY_RULE_SHORT} · ${decisiveProgressLabel(winner, redProgress, blueProgress)}`

  if (winner === 'RED')
    return (
      <span
        title={title}
        className="flex cursor-help items-center gap-1 rounded-full border border-[#fecdca] bg-[#fef3f2] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b42318]"
      >
        <Swords className="h-2.5 w-2.5" /> GANA RED
      </span>
    )
  if (winner === 'BLUE')
    return (
      <span
        title={title}
        className="flex cursor-help items-center gap-1 rounded-full border border-[#b2ddff] bg-[#f0f9ff] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#026aa2]"
      >
        <ShieldCheck className="h-2.5 w-2.5" /> GANA BLUE
      </span>
    )
  return (
    <span
      title={title}
      className="flex cursor-help items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]"
    >
      <Minus className="h-2.5 w-2.5" /> EMPATE
    </span>
  )
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(campaigns: CampaignListItemDTO[]) {
  const header = [
    'ID', 'Inicio', 'Fin', 'Escenario', 'Empresa', 'Industria', 'Dificultad',
    'Estado', 'Ganador', 'Puntos RED', 'Puntos BLUE', 'Progreso RED %', 'Progreso BLUE %',
  ]
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('es-ES') : '')
  const rows = campaigns.map((c) => [
    c.id,
    fmt(c.startedAt),
    fmt(c.endedAt),
    c.scenario.codename,
    c.scenario.company,
    c.scenario.industry,
    c.scenario.difficulty,
    c.status,
    c.winner ?? (c.status === 'COMPLETED' ? 'DRAW' : ''),
    c.redScore,
    c.blueScore,
    c.redProgress,
    c.blueProgress,
  ])
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n')
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  downloadBlob(
    csv,
    'text/csv;charset=utf-8',
    `area-ai-campanas-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`
  )
}

// ── Informe agregado del archivo (Markdown, complemento del CSV) ──

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function exportMarkdown(campaigns: CampaignListItemDTO[], filtersDesc: string) {
  const completed = campaigns.filter((c) => c.status === 'COMPLETED')
  const running = campaigns.filter((c) => c.status === 'RUNNING')
  const aborted = campaigns.length - completed.length - running.length
  const redWins = completed.filter((c) => c.winner === 'RED').length
  const blueWins = completed.filter((c) => c.winner === 'BLUE').length
  const draws = completed.length - redWins - blueWins
  const pct = (n: number) => (completed.length > 0 ? `${Math.round((n / completed.length) * 1000) / 10}%` : '—')
  const avg = (nums: number[]) => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null)
  const fmtAvg = (v: number | null, digits = 0) => (v == null ? '—' : v.toFixed(digits))
  const avgRedProgress = avg(completed.map((c) => c.redProgress))
  const avgBlueProgress = avg(completed.map((c) => c.blueProgress))
  const avgRedScore = avg(completed.map((c) => c.redScore))
  const avgBlueScore = avg(completed.map((c) => c.blueScore))
  const durations = completed
    .filter((c) => c.endedAt)
    .map((c) => new Date(c.endedAt as string).getTime() - new Date(c.startedAt).getTime())
  const avgDuration = avg(durations)
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('es-ES') : '—')
  const scenarioTop = Object.entries(
    campaigns.reduce<Record<string, number>>((acc, c) => {
      acc[c.scenario.codename] = (acc[c.scenario.codename] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]

  const now = new Date()
  const lines: string[] = [
    '# Informe agregado del archivo — area·ai',
    '',
    `- **Generado:** ${now.toLocaleString('es-ES')}`,
    `- **Campañas incluidas:** ${campaigns.length}`,
    `- **Filtros aplicados:** ${filtersDesc}`,
    '',
    '## Resumen ejecutivo',
    '',
    '| Métrica | Valor |',
    '| --- | --- |',
    `| Campañas incluidas | ${campaigns.length} |`,
    `| Finalizadas · en curso · abortadas | ${completed.length} · ${running.length} · ${aborted} |`,
    `| Victorias RED | ${redWins} (${pct(redWins)}) |`,
    `| Victorias BLUE | ${blueWins} (${pct(blueWins)}) |`,
    `| Empates | ${draws} (${pct(draws)}) |`,
    `| Progreso medio de objetivos (RED / BLUE) | ${fmtAvg(avgRedProgress)} / ${fmtAvg(avgBlueProgress)} de 100 |`,
    `| Puntuación media (RED / BLUE) | ${fmtAvg(avgRedScore, 1)} / ${fmtAvg(avgBlueScore, 1)} |`,
    `| Duración media de campaña | ${avgDuration == null ? '—' : formatDuration(avgDuration)} |`,
    `| Escenario más repetido | ${scenarioTop ? `${scenarioTop[0]} (${scenarioTop[1]} campaña${scenarioTop[1] === 1 ? '' : 's'})` : '—'} |`,
    '',
    '> Recuerda: el ganador se decide por progreso de objetivos (≥70 y por delante del rival); la puntuación refleja impacto y detecciones.',
    '',
    '## Campañas',
    '',
  ]

  for (const [i, c] of campaigns.entries()) {
    const winnerLabel =
      c.winner === 'RED'
        ? 'GANA RED'
        : c.winner === 'BLUE'
          ? 'GANA BLUE'
          : c.status === 'RUNNING'
            ? 'EN CURSO'
            : c.status === 'COMPLETED'
              ? 'EMPATE'
              : 'ABORTADA'
    const duration = c.endedAt
      ? formatDuration(new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime())
      : '—'
    lines.push(
      `### ${i + 1}. ${c.scenario.codename} — ${c.scenario.company} (${c.scenario.industry})`,
      '',
      `- **Resultado:** ${winnerLabel}${
        c.status === 'COMPLETED'
          ? ` · ${c.redScore}–${c.blueScore} (objetivos RED ${c.redProgress}% vs BLUE ${c.blueProgress}%)`
          : ''
      }`,
      `- **Periodo:** ${fmtDate(c.startedAt)} → ${fmtDate(c.endedAt)} (${duration})`,
      `- **Dificultad:** ${c.scenario.difficulty}/5`,
      `- **Ficha completa:** /historial/${c.id}`,
      ''
    )
  }

  lines.push(
    '---',
    'La telemetría completa de cada enfrentamiento (comandos reales, evidencia HTTP y lecciones archivadas) está disponible en la ficha de cada campaña y en su informe individual descargable.',
    'Generado por area·ai — laboratorio adversarial de agentes IA.'
  )

  const pad = (n: number) => String(n).padStart(2, '0')
  downloadBlob(
    lines.join('\n'),
    'text/markdown;charset=utf-8',
    `area-ai-informe-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`
  )
}

/**
 * Informe agregado del archivo (backlog #3, Ronda 6): Markdown con
 * resumen estadístico, desglose por escenario y detalle de cada
 * campaña incluida. Complemento legible al CSV (que es el formato
 * de intercambio); el informe es el formato de lectura/análisis.
 */
function exportReport(campaigns: CampaignListItemDTO[], filterDescription: string) {
  const completed = campaigns.filter((c) => c.status === 'COMPLETED')
  const redWins = completed.filter((c) => c.winner === 'RED').length
  const blueWins = completed.filter((c) => c.winner === 'BLUE').length
  const draws = completed.length - redWins - blueWins
  const running = campaigns.filter((c) => c.status === 'RUNNING').length
  const aborted = campaigns.length - completed.length - running
  const pct = (n: number) => (completed.length ? ` ${Math.round((n / completed.length) * 100)}%` : '')
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—')

  // Desglose por escenario (los codenames ya llegan únicos y ordenados)
  const scenarios = new Map<string, CampaignListItemDTO[]>()
  for (const c of campaigns) {
    const list = scenarios.get(c.scenario.codename) ?? []
    list.push(c)
    scenarios.set(c.scenario.codename, list)
  }

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('es-ES') : '—')
  const stateLabel: Record<string, string> = { COMPLETED: 'Finalizada', RUNNING: 'En curso', ABORTED: 'Abortada' }
  const winnerLabel = (c: CampaignListItemDTO) =>
    c.status === 'COMPLETED' ? (c.winner === 'RED' ? 'RED' : c.winner === 'BLUE' ? 'BLUE' : 'Empate') : '—'

  const lines: string[] = [
    '# Informe agregado del archivo de campañas',
    '',
    'Proyecto **area·ai** — sandbox Red Team vs Blue Team con agentes IA.',
    '',
    `- **Generado:** ${new Date().toLocaleString('es-ES')}`,
    `- **Campañas incluidas:** ${campaigns.length}${filterDescription}`,
    '- **Regla de victoria:** progreso de objetivos (≥70 y por delante del rival); la puntuación refleja impacto y detecciones.',
    '',
    '## Resumen agregado',
    '',
    '| Métrica | Valor |',
    '|---|---|',
    `| Campañas incluidas | ${campaigns.length} |`,
    `| Finalizadas | ${completed.length} |`,
    `| Victorias RED | ${redWins}${pct(redWins)} |`,
    `| Victorias BLUE | ${blueWins}${pct(blueWins)} |`,
    `| Empates | ${draws}${pct(draws)} |`,
    `| En curso | ${running} |`,
    `| Abortadas | ${aborted} |`,
    `| Puntuación media RED | ${avg(completed.map((c) => c.redScore))} |`,
    `| Puntuación media BLUE | ${avg(completed.map((c) => c.blueScore))} |`,
    `| Progreso medio de objetivos RED | ${avg(completed.map((c) => c.redProgress))}% |`,
    `| Progreso medio de objetivos BLUE | ${avg(completed.map((c) => c.blueProgress))}% |`,
    '',
    '## Por escenario',
    '',
    '| Escenario | Empresa | Campañas | RED | BLUE | Empates | Obj. RED medio | Obj. BLUE medio |',
    '|---|---|---|---|---|---|---|---|',
  ]

  for (const [codename, list] of [...scenarios.entries()].sort()) {
    const done = list.filter((c) => c.status === 'COMPLETED')
    const r = done.filter((c) => c.winner === 'RED').length
    const b = done.filter((c) => c.winner === 'BLUE').length
    const company = list[0]?.scenario.company ?? '—'
    lines.push(
      `| ${codename} | ${company} | ${list.length} | ${r} | ${b} | ${done.length - r - b} | ${avg(done.map((c) => c.redProgress))}% | ${avg(done.map((c) => c.blueProgress))}% |`
    )
  }

  lines.push(
    '',
    '## Detalle de campañas',
    '',
    '| # | Escenario | Inicio | Estado | Ganador | Puntos (RED–BLUE) | Objetivos (RED/BLU) | Ficha |',
    '|---|---|---|---|---|---|---|---|'
  )
  campaigns.forEach((c, i) => {
    lines.push(
      `| ${i + 1} | ${c.scenario.codename} | ${fmt(c.startedAt)} | ${stateLabel[c.status] ?? c.status} | ${winnerLabel(c)} | ${c.redScore}–${c.blueScore} | ${c.redProgress}% / ${c.blueProgress}% | \`/historial/${c.id}\` |`
    )
  })

  lines.push(
    '',
    '---',
    '',
    '_Informe generado por la interfaz de area·ai a partir del archivo local. El ganador se decide por progreso de objetivos, no por la puntuación (ver cabecera)._'
  )

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  a.href = url
  a.download = `area-ai-informe-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryPanel({
  campaigns,
  initialResult = 'ALL',
}: {
  campaigns: CampaignListItemDTO[]
  initialResult?: ResultFilter
}) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ResultFilter>(initialResult)
  const [scenario, setScenario] = useState('ALL')

  const scenarioOptions = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.scenario.codename))).sort(),
    [campaigns]
  )

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim())
    return campaigns.filter((c) => {
      if (scenario !== 'ALL' && c.scenario.codename !== scenario) return false
      if (result === 'RED' && c.winner !== 'RED') return false
      if (result === 'BLUE' && c.winner !== 'BLUE') return false
      if (result === 'RUNNING' && c.status !== 'RUNNING') return false
      if (result === 'DRAW' && (c.status !== 'COMPLETED' || c.winner === 'RED' || c.winner === 'BLUE')) return false
      if (q) {
        const hay = normalizeText(`${c.scenario.codename} ${c.scenario.company} ${c.scenario.industry}`)
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [campaigns, query, result, scenario])

  // Descripción legible de los filtros activos, para la cabecera del informe agregado
  const filtersDesc = useMemo(() => {
    const parts: string[] = []
    if (query.trim()) parts.push(`búsqueda «${query.trim()}»`)
    if (result !== 'ALL') parts.push(RESULT_FILTER_DESC[result])
    if (scenario !== 'ALL') parts.push(`escenario ${scenario}`)
    return parts.length > 0 ? parts.join(' · ') : 'ninguno (archivo completo)'
  }, [query, result, scenario])

  if (campaigns.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-2 rounded-xl p-8 text-center text-[#667085]">
        <History className="h-5 w-5" />
        <p className="text-sm">Aún no hay campañas finalizadas. Lanza la primera desde el panel de mando.</p>
      </div>
    )
  }

  const hasFilters = query.trim() !== '' || result !== 'ALL' || scenario !== 'ALL'

  // Descripción legible de los filtros activos, para la cabecera del informe exportado
  const filterDescription = !hasFilters
    ? ' (sin filtros: archivo completo)'
    : ` (filtros: ${[
        query.trim() && `búsqueda «${query.trim()}»`,
        result !== 'ALL' && RESULT_FILTERS.find((f) => f.key === result)?.label.toLowerCase(),
        scenario !== 'ALL' && `escenario ${scenario}`,
      ]
        .filter(Boolean)
        .join(', ')})`

  return (
    <div className="space-y-3.5">
      {/* Barra de herramientas: búsqueda + filtros + exportación */}
      <div className="panel flex flex-wrap items-center gap-2 rounded-xl p-2.5">
        <label className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98a2b3]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por codename, empresa…"
            className="w-full rounded-lg border border-[#e4e7ec] bg-white py-1.5 pl-8 pr-2.5 text-[12px] text-[#101828] placeholder:text-[#98a2b3] focus:border-[#d0d5dd] focus:outline-none focus:ring-2 focus:ring-[#eaecf0]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtrar por resultado">
          {RESULT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setResult(f.key)}
              data-active={result === f.key}
              className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#667085] transition-colors hover:border-[#d0d5dd] hover:text-[#101828] data-[active=true]:border-[#101828] data-[active=true]:bg-[#101828] data-[active=true]:text-white"
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          aria-label="Filtrar por escenario"
          className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#475467] focus:border-[#d0d5dd] focus:outline-none"
        >
          <option value="ALL">Todos los escenarios</option>
          {scenarioOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono-tight text-[10px] text-[#98a2b3]">
            {filtered.length} de {campaigns.length}
          </span>
          <button
            type="button"
            onClick={() => exportMarkdown(filtered, filtersDesc)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#667085] shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-50"
            title="Descargar un informe agregado en Markdown de la selección filtrada (resumen ejecutivo + una sección por campaña)"
          >
            <FileText className="h-3 w-3" /> Informe
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#667085] shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-50"
            title="Descargar la lista filtrada en CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          <button
            type="button"
            onClick={() => exportReport(filtered, filterDescription)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#667085] shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-50"
            title="Descargar el informe agregado en Markdown de la lista filtrada (resumen, por escenario y detalle)"
          >
            <FileText className="h-3 w-3" /> Informe
          </button>
        </div>
      </div>

      {hasFilters && filtered.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 rounded-xl p-8 text-center text-[#667085]">
          <Search className="h-5 w-5" />
          <p className="text-sm">Ninguna campaña coincide con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="nice-scroll max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4 }}
            >
              <Link
                href={`/historial/${c.id}`}
                className="panel panel-hover group block rounded-xl p-3.5 transition-colors"
                aria-label={`Ver ficha completa de la campaña ${c.scenario.codename}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono-tight text-[12px] font-bold tracking-wider text-[#101828]">
                      {c.scenario.codename}
                      <span className="ml-2 font-normal text-[#667085]">· {c.scenario.company}</span>
                    </p>
                    <p className="mt-0.5 font-mono-tight text-[10.5px] text-[#98a2b3]">
                      {new Date(c.startedAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · dificultad {c.scenario.difficulty}/5
                      {c.status === 'COMPLETED' && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          · marcador <b className="text-[#475467]">{c.redScore}–{c.blueScore}</b>
                          <span className="ml-1 text-[#98a2b3]">· {VICTORY_RULE_SHORT}:</span>
                          <b
                            className="cursor-help text-[#475467]"
                            title={`El ganador lo decide el progreso del objetivo, no la puntuación (${c.redScore}–${c.blueScore} son puntos de actividad). ${VICTORY_RULE_DETAIL}`}
                          >
                            {decisiveProgressLabel(c.winner, c.redProgress, c.blueProgress)}
                          </b>
                          <Info className="h-3 w-3 text-[#d0d5dd]" />
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === 'COMPLETED' ? (
                      <WinnerBadge winner={c.winner} redProgress={c.redProgress} blueProgress={c.blueProgress} />
                    ) : c.status === 'RUNNING' ? (
                      <span className="flex items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]">
                        <Hourglass className="h-2.5 w-2.5" /> EN CURSO
                      </span>
                    ) : (
                      <span className="rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#667085]">
                        ABORTADA
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#d0d5dd] transition-all group-hover:translate-x-0.5 group-hover:text-[#98a2b3]" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-12 font-mono-tight text-[10px] text-[#b42318]">RED {c.redProgress}%</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${c.redProgress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="h-full rounded-full bg-[#d92d20]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 font-mono-tight text-[10px] text-[#026aa2]">BLU {c.blueProgress}%</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${c.blueProgress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="h-full rounded-full bg-[#0086c9]"
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
