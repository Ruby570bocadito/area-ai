'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  CalendarClock,
  FileJson,
  FileSpreadsheet,
  Flame,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { normalizeText, exportFilename } from '@/lib/text'
import { downloadBlob } from '@/lib/download'
import { knowledgeScore } from '@/lib/sim/knowledge-score'
import { buildKnowledgeCsv, buildKnowledgeJson } from '@/lib/knowledge-export'
import type { KnowledgeDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Memoria del sistema: búsqueda de texto, filtro por categoría
// y ordenación (fuerza, confianza, usos, recientes) sobre TODA
// la memoria. Cada tarjeta muestra su campaña de origen.
// ─────────────────────────────────────────────────────────────

type KnowledgeItem = KnowledgeDTO & { campaignCodename?: string | null }
type SortKey = 'FUERZA' | 'CONFIANZA' | 'USOS' | 'RECIENTES'

// ─────────────────────────────────────────────────────────────
// Transporte de las exportaciones (Ronda 12, dedupe Ronda 13):
// la generación vive en src/lib/knowledge-export.ts (módulo puro
// testeado); la descarga (downloadBlob) y la marca temporal de los
// nombres de fichero (exportFilename) viven como fuente única en
// src/lib/download.ts y src/lib/text.ts — compartidas con los
// exportadores de campañas y de telemetría de la ficha.
// ─────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  TACTICA: 'Tactics',
  TECNICA: 'Technique',
  DEFENSA: 'Defense',
  VULNERABILIDAD: 'Vulnerability',
  LECCION: 'Lesson',
  INTELIGENCIA: 'Intelligence',
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'FUERZA', label: 'Strongest' },
  { key: 'CONFIANZA', label: 'Most confidence' },
  { key: 'USOS', label: 'Most used' },
  { key: 'RECIENTES', label: 'Most recent' },
]

function KnowledgeCard({ k, index, team }: { k: KnowledgeItem; index: number; team: 'RED' | 'BLUE' }) {
  const isRed = team === 'RED'
  const isFresh = Date.now() - new Date(k.createdAt).getTime() < 5 * 60 * 1000
  const eff = k.timesUsed > 0 ? Math.round((k.timesWorked / k.timesUsed) * 100) : null

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.4 }}
      className="panel panel-hover relative overflow-hidden rounded-xl p-4"
    >
      {isFresh && (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider text-[#b54708]">
          <Sparkles className="h-2.5 w-2.5" /> Nuevo
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            isRed ? 'bg-[#fef3f2] text-[#b42318]' : 'bg-[#f0f9ff] text-[#026aa2]'
          )}
        >
          {CATEGORY_LABEL[k.category] ?? k.category}
        </span>
        {eff !== null && eff >= 50 && <TrendingUp className="h-3 w-3 text-[#12b76a]" />}
      </div>
      <h4 className="mt-2 text-[13px] font-semibold leading-snug text-ink-900">{k.title}</h4>
      <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-500">{k.content}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {k.tags
          .split(',')
          .filter(Boolean)
          .slice(0, 4)
          .map((t) => (
            <span key={t} className="rounded bg-[#f2f4f7] px-1.5 py-px font-mono-tight text-[9px] text-ink-500">
              #{t.trim()}
            </span>
          ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Brain className={cn('h-3.5 w-3.5', isRed ? 'text-[#d92d20]' : 'text-[#0086c9]')} />
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
          <motion.div
            className={cn('h-full rounded-full', isRed ? 'bg-[#d92d20]' : 'bg-[#0086c9]')}
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.round(k.confidence * 100)}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono-tight text-[10px] text-ink-500">
          {Math.round(k.confidence * 100)}% · {k.timesUsed}usos
        </span>
        {isFresh && <Flame className="h-3 w-3 text-[#d97706]" />}
      </div>
      <p className="mt-2 flex items-center gap-1.5 border-t border-[#f2f4f7] pt-2 font-mono-tight text-[9px] text-ink-400">
        <CalendarClock className="h-2.5 w-2.5 shrink-0" />
        {new Date(k.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
        {k.campaignCodename && (
          <>
            <span className="text-[#d0d5dd]">·</span> originada en{' '}
            <span className="font-bold text-[#475467]">{k.campaignCodename}</span>
          </>
        )}
      </p>
    </motion.article>
  )
}

function sortItems(items: KnowledgeItem[], key: SortKey): KnowledgeItem[] {
  const arr = [...items]
  switch (key) {
    case 'CONFIANZA':
      return arr.sort((a, b) => b.confidence - a.confidence)
    case 'USOS':
      return arr.sort((a, b) => b.timesUsed - a.timesUsed)
    case 'RECIENTES':
      return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'FUERZA':
    default:
      return arr.sort((a, b) => knowledgeScore(b) - knowledgeScore(a))
  }
}

function useKnowledgeFilter(items: KnowledgeItem[], query: string, category: string, sort: SortKey) {
  return useMemo(() => {
    const q = normalizeText(query.trim())
    const filtered = items.filter((k) => {
      if (category !== 'ALL' && k.category !== category) return false
      if (q) {
        const hay = normalizeText(`${k.title} ${k.content} ${k.tags} ${k.agentCodename ?? ''}`)
        if (!hay.includes(q)) return false
      }
      return true
    })
    return sortItems(filtered, sort)
  }, [items, query, category, sort])
}

export function KnowledgePanel({
  red,
  blue,
}: {
  red: KnowledgeItem[]
  blue: KnowledgeItem[]
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('FUERZA')

  const redFiltered = useKnowledgeFilter(red, query, category, sort)
  const blueFiltered = useKnowledgeFilter(blue, query, category, sort)

  const categories = useMemo(
    () => Array.from(new Set([...red, ...blue].map((k) => k.category))).sort(),
    [red, blue]
  )

  // Descripción legible de los filtros activos, para el metadato
  // «filters» del JSON exportado y los titles de los botones.
  const filtersDesc = useMemo(() => {
    const parts: string[] = []
    if (query.trim()) parts.push(`search “${query.trim()}”`)
    if (category !== 'ALL') parts.push(`category ${CATEGORY_LABEL[category] ?? category}`)
    parts.push(`sort ${SORT_OPTIONS.find((o) => o.key === sort)?.label ?? sort}`)
    return parts.join(' · ')
  }, [query, category, sort])

  // Selección exportada: los dos equipos ya filtrados y ordenados
  // (RED primero, luego BLUE), reflejando exactamente lo que el
  // usuario ve en las pestañas con los filtros activos.
  const exportSelection = useMemo(() => [...redFiltered, ...blueFiltered], [redFiltered, blueFiltered])
  const hasMemory = red.length > 0 || blue.length > 0

  const handleExportCsv = () => {
    if (exportSelection.length === 0) return
    downloadBlob(
      buildKnowledgeCsv(exportSelection),
      'text/csv;charset=utf-8',
      exportFilename('conocimiento', 'csv')
    )
  }
  const handleExportJson = () => {
    if (exportSelection.length === 0) return
    downloadBlob(
      buildKnowledgeJson(exportSelection, {
        filtersDesc,
        red: redFiltered.length,
        blue: blueFiltered.length,
      }),
      'application/json;charset=utf-8',
      exportFilename('knowledge', 'json')
    )
  }

  return (
    <div className="space-y-3.5">
      {/* Barra de herramientas: búsqueda + categorías + orden */}
      <div className="panel flex flex-wrap items-center gap-2 rounded-xl p-2.5">
        <label className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons, tags, agent…"
            className="w-full rounded-lg border border-[#e4e7ec] bg-white py-1.5 pl-8 pr-2.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-[#d0d5dd] focus:outline-none focus:ring-2 focus:ring-[#eaecf0]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setCategory('ALL')}
            data-active={category === 'ALL'}
            className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 transition-colors hover:border-[#d0d5dd] hover:text-ink-900 data-[active=true]:border-ink-900 data-[active=true]:bg-ink-900 data-[active=true]:text-white"
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              data-active={category === cat}
              className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 transition-colors hover:border-[#d0d5dd] hover:text-ink-900 data-[active=true]:border-ink-900 data-[active=true]:bg-ink-900 data-[active=true]:text-white"
            >
              {CATEGORY_LABEL[cat] ?? cat}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono-tight text-[10px] text-ink-400">
            {exportSelection.length} of {red.length + blue.length}
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!hasMemory || exportSelection.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Download the filtered selection (${filtersDesc}) as CSV — same dialect as the campaigns exporter: UTF-8 BOM, “;” separator, RFC 4180 escaping`}
          >
            <FileSpreadsheet className="h-3 w-3" /> CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={!hasMemory || exportSelection.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Download the filtered selection (${filtersDesc}) as JSON with metadata: instant, filters, per-team count, precomputed success rate and tags as a list`}
          >
            <FileJson className="h-3 w-3" /> JSON
          </button>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar lecciones"
          className="rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-[#475467] focus:border-[#d0d5dd] focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      <Tabs defaultValue="red" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 border border-[#e4e7ec] bg-white shadow-sm">
          <TabsTrigger
            value="red"
            className="font-mono-tight text-[11px] data-[state=active]:bg-[#fef3f2] data-[state=active]:text-[#b42318]"
          >
            Inteligencia RED ({redFiltered.length}
            {redFiltered.length !== red.length && `/${red.length}`})
          </TabsTrigger>
          <TabsTrigger
            value="blue"
            className="font-mono-tight text-[11px] data-[state=active]:bg-[#f0f9ff] data-[state=active]:text-[#026aa2]"
          >
            Inteligencia BLUE ({blueFiltered.length}
            {blueFiltered.length !== blue.length && `/${blue.length}`})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="red" className="mt-4">
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {redFiltered.map((k, i) => (
                <KnowledgeCard key={k.id} k={k} index={i} team="RED" />
              ))}
            </div>
          </AnimatePresence>
          {redFiltered.length === 0 && (
            <EmptyState
              compact
              icon={Swords}
              title={red.length === 0 ? 'No offensive knowledge yet' : 'No RED lessons match'}
              description={
                red.length === 0
                  ? 'RED lessons are archived when each campaign ends and are injected into later ones to sharpen the attack.'
                  : 'Adjust the search or the filters to find lessons for this team.'
              }
              action={red.length === 0 ? { label: 'Launch a campaign', href: '/' } : undefined}
            />
          )}
        </TabsContent>
        <TabsContent value="blue" className="mt-4">
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {blueFiltered.map((k, i) => (
                <KnowledgeCard key={k.id} k={k} index={i} team="BLUE" />
              ))}
            </div>
          </AnimatePresence>
          {blueFiltered.length === 0 && (
            <EmptyState
              compact
              icon={ShieldCheck}
              title={blue.length === 0 ? 'No defensive knowledge yet' : 'No BLUE lessons match'}
              description={
                blue.length === 0
                  ? 'BLUE lessons are archived when each campaign ends and harden upcoming defenses.'
                  : 'Adjust the search or the filters to find lessons for this team.'
              }
              action={blue.length === 0 ? { label: 'Launch a campaign', href: '/' } : undefined}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
