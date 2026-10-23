'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bookmark,
  BookmarkPlus,
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
  X,
} from 'lucide-react'
import {
  buildSuggestedName,
  sanitizeName,
  sanitizeQuery,
  SAVED_FILTERS_NAME_MAX,
  useSavedFilters,
  type SavedFilter,
} from '@/hooks/use-saved-filters'
import { normalizeText, csvEscapeCell, exportFilename } from '@/lib/text'
import { useToast } from '@/hooks/use-toast'
import { EmptyState } from './empty-state'
import { downloadBlob } from '@/lib/download'
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
// por escenario, Ronda 12) e initialQuery (?q=); y con
// onFiltersChange refleja cada cambio de filtro en la URL
// (deep-links-historial) para que la vista filtrada sea compartible.
// Además guarda y nombra combinaciones de filtros (filtros-guardados):
// la tienda localStorage vive en src/hooks/use-saved-filters.ts.
// ─────────────────────────────────────────────────────────────

type ResultFilter = 'ALL' | 'RED' | 'BLUE' | 'DRAW' | 'RUNNING'

export type { ResultFilter }

const RESULT_FILTERS: Array<{ key: ResultFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'RED', label: 'RED wins' },
  { key: 'BLUE', label: 'BLUE wins' },
  { key: 'DRAW', label: 'Draws' },
  { key: 'RUNNING', label: 'In progress' },
]

const RESULT_FILTER_DESC: Record<ResultFilter, string> = {
  ALL: 'all',
  RED: 'only RED victories',
  BLUE: 'only BLUE victories',
  DRAW: 'only draws',
  RUNNING: 'only in progress',
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
        <Swords className="h-2.5 w-2.5" /> RED WINS
      </span>
    )
  if (winner === 'BLUE')
    return (
      <span
        title={title}
        className="flex cursor-help items-center gap-1 rounded-full border border-[#b2ddff] bg-[#f0f9ff] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#026aa2]"
      >
        <ShieldCheck className="h-2.5 w-2.5" /> BLUE WINS
      </span>
    )
  return (
    <span
      title={title}
      className="flex cursor-help items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]"
    >
      <Minus className="h-2.5 w-2.5" /> DRAW
    </span>
  )
}

// El escapado CSV (RFC 4180) y la marca temporal de los nombres de
// fichero (exportFilename) viven en src/lib/text.ts como fuente única
// compartida con el exportador de conocimiento (knowledge-export.ts) y
// el de telemetría de la ficha (event-export.ts). El transporte de
// descarga (downloadBlob) vive en src/lib/download.ts — utilidad de
// cliente única para los tres exportadores.

function exportCsv(campaigns: CampaignListItemDTO[]) {
  const header = [
    'ID', 'Started', 'Ended', 'Scenario', 'Company', 'Industry', 'Difficulty',
    'Status', 'Winner', 'RED score', 'BLUE score', 'RED progress %', 'BLUE progress %',
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
    exportFilename('campaigns', 'csv')
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
    exportFilename('report', 'md')
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
  initialQuery = '',
  onFiltersChange,
}: {
  campaigns: CampaignListItemDTO[]
  initialResult?: ResultFilter
  /** Escenario preseleccionado por deep-link (?escenario=CODENAME). */
  initialScenario?: string
  /** Búsqueda preseleccionada por deep-link (?q=TEXTO). */
  initialQuery?: string
  /** deep-links-historial: notifica cada cambio de filtro para que la
   *  página reescriba la URL (replaceState, sin navegación). */
  onFiltersChange?: (f: { result: ResultFilter; scenario: string; query: string }) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [result, setResult] = useState<ResultFilter>(initialResult)
  const [scenario, setScenario] = useState(initialScenario)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  // filtros-guardados: presets con nombre (persistencia local) y el
  // formulario inline para guardar la combinación activa.
  const { saved, saveSavedFilter, removeSavedFilter } = useSavedFilters()
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const { toast } = useToast()
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

  // deep-links-historial: los filtros vivos se reflejan en la URL. El primer
  // render no escribe (la URL ya trae los valores del deep-link con los que
  // el panel se inicializó) y el escenario notificado es el EFECTIVO — si el
  // enlace traía un codename caducado (degradado a «Todos»), no se revive.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!syncedRef.current) {
      syncedRef.current = true
      return
    }
    onFiltersChange?.({ result, scenario: effectiveScenario, query })
  }, [result, effectiveScenario, query, onFiltersChange])

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
    if (query.trim()) parts.push(`search “${query.trim()}”`)
    if (result !== 'ALL') parts.push(RESULT_FILTER_DESC[result])
    if (effectiveScenario !== 'ALL') parts.push(`scenario ${effectiveScenario}`)
    return parts.length > 0 ? parts.join(' · ') : 'none (full archive)'
  }, [query, result, effectiveScenario])

  // filtros-guardados: aplicar un preset recorre las vías normales de
  // estado (setQuery/setResult/setScenario), así que la URL se reescribe
  // sola vía onFiltersChange (deep-links-historial). El escenario de un
  // preset caducado degrada a «All scenarios» con el mismo patrón
  // anti-enlace-caducado del deep-link. Definidos tras los useMemo de los
  // que dependen para preservar la memoización del compilador de React.
  const applySavedFilter = (f: SavedFilter) => {
    setQuery(f.query)
    setResult(f.result)
    setScenario(
      scenarioOptions.length === 0 || scenarioOptions.includes(f.scenario) ? f.scenario : 'ALL'
    )
    setSaveOpen(false)
  }

  const openSaveForm = () => {
    const resultLabel = RESULT_FILTERS.find((f) => f.key === result)?.label ?? 'All'
    setSaveName(buildSuggestedName(resultLabel, effectiveScenario, query))
    setSaveOpen(true)
  }

  const handleSaveSubmit = (e: FormEvent) => {
    e.preventDefault()
    const resultLabel = RESULT_FILTERS.find((f) => f.key === result)?.label ?? 'All'
    saveSavedFilter({
      name: sanitizeName(saveName) || buildSuggestedName(resultLabel, effectiveScenario, query),
      result,
      scenario: effectiveScenario,
      query: sanitizeQuery(query),
    })
    setSaveOpen(false)
  }

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
      // informe no se pierde — se descarga como el botón Informe. El aviso
      // explica por qué el botón dice «Descargado» en lugar de «Copiado»
      // (caso «exportación lista» de la política de toasts).
      exportMarkdown(filtered, filtersDesc)
      toast({
        title: 'Report downloaded as a file',
        description:
          'The clipboard is not available in this browser, so the aggregate report was downloaded in Markdown.',
      })
      setCopyState('error')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopyState('idle'), 2500)
    }
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="The campaign archive is empty"
        description="Every finished campaign will be recorded here with its full record, events and archived lessons."
        action={{ label: 'Go to the command deck', href: '/' }}
      />
    )
  }

  // El escenario EFECTIVO (no el crudo) decide hasFilters: con un deep-link
  // caducado degradado a «All» la barra no queda marcada como filtrada.
  const hasFilters = query.trim() !== '' || result !== 'ALL' || effectiveScenario !== 'ALL'

  return (
    <div className="space-y-3.5">
      {/* Barra de herramientas: búsqueda + filtros + exportación */}
      <div className="panel flex flex-wrap items-center gap-2 rounded-xl p-2.5">
        <label className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by codename, company…"
            className="w-full rounded-lg border border-[#e4e7ec] bg-white py-1.5 pl-8 pr-2.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-[#d0d5dd] focus:outline-none focus:ring-2 focus:ring-[#eaecf0]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by outcome">
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
          aria-label="Filter by scenario"
          className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#475467] focus:border-[#d0d5dd] focus:outline-none"
        >
          <option value="ALL">All scenarios</option>
          {scenarioOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={openSaveForm}
          disabled={!hasFilters}
          title="Save the current filter combination with a name (stored in this browser)"
          className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BookmarkPlus className="h-3 w-3" /> Save
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono-tight text-[10px] text-ink-400">
            {filtered.length} of {campaigns.length}
          </span>
          <button
            type="button"
            onClick={handleCopyReport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="Copy the aggregate Markdown report of the filtered selection to the clipboard (same content as the Report button download)"
          >
            {copyState === 'copied' ? (
              <>
                <Check className="h-3 w-3 text-[#067647]" /> Copied
              </>
            ) : copyState === 'error' ? (
              <>
                <Download className="h-3 w-3 text-[#b54708]" /> Downloaded
              </>
            ) : (
              <>
                <ClipboardCopy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => exportMarkdown(filtered, filtersDesc)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download an aggregate Markdown report of the filtered selection (executive summary + one section per campaign)"
          >
            <FileText className="h-3 w-3" /> Report
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download the filtered list as CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      </div>

      {saveOpen && (
        <form
          onSubmit={handleSaveSubmit}
          className="panel flex flex-wrap items-center gap-2 rounded-xl p-2.5"
        >
          <Bookmark className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={SAVED_FILTERS_NAME_MAX}
            placeholder="Name for this filter combination…"
            aria-label="Name for the saved filter"
            autoFocus
            className="min-w-[180px] flex-1 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-[#d0d5dd] focus:outline-none focus:ring-2 focus:ring-[#eaecf0] sm:max-w-[320px]"
          />
          <span className="font-mono-tight text-[10px] text-ink-400" aria-hidden>
            {saveName.length}/{SAVED_FILTERS_NAME_MAX}
          </span>
          <button
            type="submit"
            className="rounded-lg border border-ink-900 bg-ink-900 px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-white transition-colors hover:border-[#344054] hover:bg-[#344054]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(false)}
            className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 transition-colors hover:border-[#d0d5dd] hover:text-ink-900"
          >
            Cancel
          </button>
        </form>
      )}

      {saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saved filters">
          <span className="font-mono-tight text-[10px] font-bold uppercase tracking-wider text-ink-400">
            Saved
          </span>
          {saved.map((f) => (
            <span
              key={f.id}
              className="flex items-center gap-0.5 rounded-full border border-[#e4e7ec] bg-white py-1 pl-2.5 pr-1"
            >
              <button
                type="button"
                onClick={() => applySavedFilter(f)}
                title={`Apply filters: ${f.name}`}
                className="flex items-center gap-1 font-mono-tight text-[10px] font-bold text-ink-600 transition-colors hover:text-ink-900"
              >
                <Bookmark className="h-2.5 w-2.5 text-[#175cd3]" />
                {f.name}
              </button>
              <button
                type="button"
                onClick={() => removeSavedFilter(f.id)}
                aria-label={`Delete saved filter ${f.name}`}
                title="Delete saved filter"
                className="rounded-full p-0.5 text-ink-300 transition-colors hover:bg-[#f2f4f7] hover:text-ink-500"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {hasFilters && filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No campaigns match the filters"
          description="Try a different search term or reset the filters to see the whole archive."
          action={{
            label: 'View the whole archive',
            onClick: () => {
              setQuery('')
              setResult('ALL')
              setScenario('ALL')
            },
          }}
        />
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
                aria-label={`View the full campaign record for ${c.scenario.codename}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono-tight text-[12px] font-bold tracking-wider text-ink-900">
                      {c.scenario.codename}
                      <span className="ml-2 font-normal text-ink-500">· {c.scenario.company}</span>
                    </p>
                    <p className="mt-0.5 font-mono-tight text-[10.5px] text-ink-400">
                      {new Date(c.startedAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · difficulty {c.scenario.difficulty}/5
                      {c.status === 'COMPLETED' && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          · score <b className="text-[#475467]">{c.redScore}–{c.blueScore}</b>
                          <span className="ml-1 text-ink-400">· {VICTORY_RULE_SHORT}:</span>
                          <b
                            className="cursor-help text-[#475467]"
                            title={`The winner is decided by objective progress, not the score (${c.redScore}–${c.blueScore} are activity points). ${VICTORY_RULE_DETAIL}`}
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
                        <Hourglass className="h-2.5 w-2.5" /> IN PROGRESS
                      </span>
                    ) : (
                      <span className="rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-ink-500">
                        ABORTED
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
