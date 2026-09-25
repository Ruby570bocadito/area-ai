'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  ClipboardCopy,
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
import { normalizeText, csvEscapeCell } from '@/lib/text'
import { buildAggregateReport } from '@/lib/aggregate-report'
import { decisiveProgressLabel, VICTORY_RULE_DETAIL, VICTORY_RULE_SHORT } from '@/lib/victory'
import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Archivo completo de enfrentamientos: búsqueda, filtro por
// resultado y escenario, exportación CSV, informe agregado en
// Markdown (descarga o copia al portapapeles) y acceso a la
// ficha completa de cada campaña (/historial/[id]).
// Acepta deep-links prefiltrados: initialResult (query ?resultado=
// de /analitica) e initialScenario (query ?escenario= del balance
// por escenario, Ronda 12).
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

// El escapado CSV (RFC 4180) vive en src/lib/text.ts como fuente única
// compartida con el exportador de conocimiento (knowledge-export.ts).

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Marca temporal compartida por los nombres de fichero de exportación
// (CSV e informe Markdown): area-ai-<prefijo>-YYYYMMDD-HHMM.<ext>
function exportFilename(prefix: string, ext: 'csv' | 'md'): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `area-ai-${prefix}-${stamp}.${ext}`
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
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(csvEscapeCell).join(';')).join('\n')
  downloadBlob(
    csv,
    'text/csv;charset=utf-8',
    exportFilename('campanas', 'csv')
  )
}

// ── Informe agregado del archivo (Markdown, complemento del CSV) ──
// El generador vive en src/lib/aggregate-report.ts (módulo puro,
// compartido por la descarga y la copia al portapapeles y testeado
// de forma unitaria). Aquí solo queda el transporte al usuario.

function exportMarkdown(campaigns: CampaignListItemDTO[], filtersDesc: string) {
  const md = buildAggregateReport(campaigns, filtersDesc)
  downloadBlob(
    md,
    'text/markdown;charset=utf-8',
    exportFilename('informe', 'md')
  )
}

// Copia el informe al portapapeles con doble vía: Clipboard API
// (contexto seguro) y fallback heredado con textarea + execCommand
// (contextos no seguros o permisos restringidos). Devuelve false
// solo si ambas vías fallan, para que el llamante pueda degradar
// a la descarga y el usuario nunca pierda el informe.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // sigue al fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function HistoryPanel({
  campaigns,
  initialResult = 'ALL',
  initialScenario = 'ALL',
}: {
  campaigns: CampaignListItemDTO[]
  initialResult?: ResultFilter
  /** Escenario preseleccionado por deep-link (?escenario=CODENAME). */
  initialScenario?: string
}) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ResultFilter>(initialResult)
  const [scenario, setScenario] = useState(initialScenario)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  const scenarioOptions = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.scenario.codename))).sort(),
    [campaigns]
  )

  // Deep-link de escenario validado como ESTADO DERIVADO (sin efectos:
  // evita react-hooks/set-state-in-effect). Mientras el archivo no está
  // cargado (opciones vacías) se respeta el valor del enlace; en cuanto
  // hay opciones, un codename inexistente (enlace viejo, escenario
  // renombrado) degrada a «Todos los escenarios» sin tocar el estado
  // interno — el usuario puede seguir filtrando normalmente.
  const scenarioLinkValid =
    initialScenario === 'ALL' ||
    scenarioOptions.length === 0 ||
    scenarioOptions.includes(initialScenario)
  const effectiveScenario = scenarioLinkValid ? scenario : 'ALL'

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim())
    return campaigns.filter((c) => {
      if (effectiveScenario !== 'ALL' && c.scenario.codename !== effectiveScenario) return false
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
  }, [campaigns, query, result, effectiveScenario])

  // Descripción legible de los filtros activos, para la cabecera del informe agregado
  const filtersDesc = useMemo(() => {
    const parts: string[] = []
    if (query.trim()) parts.push(`búsqueda «${query.trim()}»`)
    if (result !== 'ALL') parts.push(RESULT_FILTER_DESC[result])
    if (effectiveScenario !== 'ALL') parts.push(`escenario ${effectiveScenario}`)
    return parts.length > 0 ? parts.join(' · ') : 'ninguno (archivo completo)'
  }, [query, result, effectiveScenario])

  // Copia el informe de la selección filtrada al portapapeles (mismo texto
  // que la descarga). Definido tras los useMemo de los que depende para
  // preservar la memoización del compilador de React.
  const handleCopyReport = async () => {
    if (filtered.length === 0 || copyState === 'copied') return
    const md = buildAggregateReport(filtered, filtersDesc)
    const ok = await copyToClipboard(md)
    if (ok) {
      setCopyState('copied')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopyState('idle'), 2000)
    } else {
      // Degradación honesta: si el entorno bloquea el portapapeles, el
      // informe no se pierde — se descarga como el botón Informe.
      exportMarkdown(filtered, filtersDesc)
      setCopyState('error')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopyState('idle'), 2500)
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-2 rounded-xl p-8 text-center text-ink-500">
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
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por codename, empresa…"
            className="w-full rounded-lg border border-[#e4e7ec] bg-white py-1.5 pl-8 pr-2.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-[#d0d5dd] focus:outline-none focus:ring-2 focus:ring-[#eaecf0]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtrar por resultado">
          {RESULT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setResult(f.key)}
              data-active={result === f.key}
              className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 transition-colors hover:border-[#d0d5dd] hover:text-ink-900 data-[active=true]:border-ink-900 data-[active=true]:bg-ink-900 data-[active=true]:text-white"
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={effectiveScenario}
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
          <span className="font-mono-tight text-[10px] text-ink-400">
            {filtered.length} de {campaigns.length}
          </span>
          <button
            type="button"
            onClick={handleCopyReport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="Copiar el informe agregado en Markdown de la selección filtrada al portapapeles (mismo contenido que la descarga del botón Informe)"
          >
            {copyState === 'copied' ? (
              <>
                <Check className="h-3 w-3 text-[#067647]" /> Copiado
              </>
            ) : copyState === 'error' ? (
              <>
                <Download className="h-3 w-3 text-[#b54708]" /> Descargado
              </>
            ) : (
              <>
                <ClipboardCopy className="h-3 w-3" /> Copiar
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => exportMarkdown(filtered, filtersDesc)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="Descargar un informe agregado en Markdown de la selección filtrada (resumen ejecutivo + una sección por campaña)"
          >
            <FileText className="h-3 w-3" /> Informe
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="Descargar la lista filtrada en CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      </div>

      {hasFilters && filtered.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 rounded-xl p-8 text-center text-ink-500">
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
                    <p className="font-mono-tight text-[12px] font-bold tracking-wider text-ink-900">
                      {c.scenario.codename}
                      <span className="ml-2 font-normal text-ink-500">· {c.scenario.company}</span>
                    </p>
                    <p className="mt-0.5 font-mono-tight text-[10.5px] text-ink-400">
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
                          <span className="ml-1 text-ink-400">· {VICTORY_RULE_SHORT}:</span>
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
                      <span className="rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-ink-500">
                        ABORTADA
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#d0d5dd] transition-all group-hover:translate-x-0.5 group-hover:text-ink-400" />
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
