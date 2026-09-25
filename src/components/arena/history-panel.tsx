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


  return (