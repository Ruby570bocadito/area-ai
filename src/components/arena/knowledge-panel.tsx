'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brain, Flame, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeDTO } from '@/lib/api-types'

const CATEGORY_LABEL: Record<string, string> = {
  TACTICA: 'Táctica',
  TECNICA: 'Técnica',
  DEFENSA: 'Defensa',
  VULNERABILIDAD: 'Vulnerabilidad',
  LECCION: 'Lección',
  INTELIGENCIA: 'Inteligencia',
}

function KnowledgeCard({ k, index, team }: { k: KnowledgeDTO; index: number; team: 'RED' | 'BLUE' }) {
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
      <h4 className="mt-2 text-[13px] font-semibold leading-snug text-[#101828]">{k.title}</h4>
      <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-[#667085]">{k.content}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {k.tags
          .split(',')
          .filter(Boolean)
          .slice(0, 4)
          .map((t) => (
            <span key={t} className="rounded bg-[#f2f4f7] px-1.5 py-px font-mono-tight text-[9px] text-[#667085]">
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
        <span className="font-mono-tight text-[10px] text-[#667085]">
          {Math.round(k.confidence * 100)}% · {k.timesUsed}usos
        </span>
        {isFresh && <Flame className="h-3 w-3 text-[#d97706]" />}
      </div>
    </motion.article>
  )
}

export function KnowledgePanel({
  red,
  blue,
}: {
  red: KnowledgeDTO[]
  blue: KnowledgeDTO[]
}) {
  return (
    <Tabs defaultValue="red" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2 border border-[#e4e7ec] bg-white shadow-sm">
        <TabsTrigger
          value="red"
          className="font-mono-tight text-[11px] data-[state=active]:bg-[#fef3f2] data-[state=active]:text-[#b42318]"
        >
          Inteligencia RED ({red.length})
        </TabsTrigger>
        <TabsTrigger
          value="blue"
          className="font-mono-tight text-[11px] data-[state=active]:bg-[#f0f9ff] data-[state=active]:text-[#026aa2]"
        >
          Inteligencia BLUE ({blue.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="red" className="mt-4">
        <AnimatePresence mode="popLayout">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {red.map((k, i) => (
              <KnowledgeCard key={k.id} k={k} index={i} team="RED" />
            ))}
          </div>
        </AnimatePresence>
        {red.length === 0 && <p className="text-sm text-[#667085]">Sin conocimiento ofensivo registrado todavía.</p>}
      </TabsContent>
      <TabsContent value="blue" className="mt-4">
        <AnimatePresence mode="popLayout">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {blue.map((k, i) => (
              <KnowledgeCard key={k.id} k={k} index={i} team="BLUE" />
            ))}
          </div>
        </AnimatePresence>
        {blue.length === 0 && <p className="text-sm text-[#667085]">Sin conocimiento defensivo registrado todavía.</p>}
      </TabsContent>
    </Tabs>
  )
}
