'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Download,
  History,
  Hourglass,
  Minus,
  Search,
  ShieldCheck,
  Swords,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Archivo completo de enfrentamientos: búsqueda, filtro por
// resultado y escenario, exportación CSV y acceso a la ficha
// completa de cada campaña (/historial/[id]).
// ─────────────────────────────────────────────────────────────

type ResultFilter = 'ALL' | 'RED' | 'BLUE' | 'DRAW' | 'RUNNING'

// Búsqueda tolerante a acentos/mayúsculas: "abaco" encuentra "ÁBACO"
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const RESULT_FILTERS: Array<{ key: ResultFilter; label: string }> = [
  { key: 'ALL', label: 'Todas' },
  { key: 'RED', label: 'Gana RED' },
  { key: 'BLUE', label: 'Gana BLUE' },
  { key: 'DRAW', label: 'Empates' },
  { key: 'RUNNING', label: 'En curso' },
]

function WinnerBadge({ winner }: { winner: string | null }) {
  if (winner === 'RED')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#fecdca] bg-[#fef3f2] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b42318]">
        <Swords className="h-2.5 w-2.5" /> GANA RED
      </span>
    )
  if (winner === 'BLUE')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#b2ddff] bg-[#f0f9ff] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#026aa2]">
        <ShieldCheck className="h-2.5 w-2.5" /> GANA BLUE
      </span>
    )
  return (
    <span className="flex items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]">
      <Minus className="h-2.5 w-2.5" /> EMPATE
    </span>
  )
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  a.href = url
  a.download = `area-ai-campanas-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryPanel({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ResultFilter>('ALL')
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
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#667085] shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-50"
            title="Descargar la lista filtrada en CSV"
          >
            <Download className="h-3 w-3" /> CSV
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
                        <span className="ml-2">
                          · resultado <b className="text-[#475467]">{c.redScore}–{c.blueScore}</b>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === 'COMPLETED' ? (
                      <WinnerBadge winner={c.winner} />
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
