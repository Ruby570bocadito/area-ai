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
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[#e8b64c]/12 px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider text-[#f0cd85]">
          <Sparkles className="h-2.5 w-2.5" /> Nuevo
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            isRed ? 'bg-[#f4536e]/12 text-[#f98ca0]' : 'bg-[#41c0ef]/12 text-[#8adcf7]'
          )}
        >
          {CATEGORY_LABEL[k.category] ?? k.category}
        </span>
        {eff !== null && eff >= 50 && <TrendingUp className="h-3 w-3 text-[#4ad6a5]" />}
      </div>
      <h4 className="mt-2 text-[13px] font-semibold leading-snug text-foreground">{k.title}</h4>
      <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{k.content}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {k.tags
          .split(',')
          .filter(Boolean)
          .slice(0, 4)
          .map((t) => (
            <span key={t} className="rounded bg-white/[0.05] px-1.5 py-px font-mono-tight text-[9px] text-muted-foreground">
              #{t.trim()}
            </span>
          ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Brain className={cn('h-3.5 w-3.5', isRed ? 'text-[#f4536e]' : 'text-[#41c0ef]')} />
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className={cn('h-full rounded-full', isRed ? 'bg-[#f4536e]' : 'bg-[#41c0ef]')}
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.round(k.confidence * 100)}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono-tight text-[10px] text-muted-foreground">
          {Math.round(k.confidence * 100)}% · {k.timesUsed}usos
        </span>
        {isFresh && <Flame className="h-3 w-3 text-[#e8b64c]" />}
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
      <TabsList className="grid w-full max-w-md grid-cols-2 border border-white/[0.07] bg-white/[0.03]">
        <TabsTrigger
          value="red"
          className="font-mono-tight text-[11px] data-[state=active]:bg-[#f4536e]/15 data-[state=active]:text-[#f98ca0]"
        >
          Inteligencia RED ({red.length})
        </TabsTrigger>
        <TabsTrigger
          value="blue"
          className="font-mono-tight text-[11px] data-[state=active]:bg-[#41c0ef]/15 data-[state=active]:text-[#8adcf7]"
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
        {red.length === 0 && <p className="text-sm text-muted-foreground">Sin conocimiento ofensivo registrado todavía.</p>}
      </TabsContent>
      <TabsContent value="blue" className="mt-4">
        <AnimatePresence mode="popLayout">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {blue.map((k, i) => (
              <KnowledgeCard key={k.id} k={k} index={i} team="BLUE" />
            ))}
          </div>
        </AnimatePresence>
        {blue.length === 0 && <p className="text-sm text-muted-foreground">Sin conocimiento defensivo registrado todavía.</p>}
      </TabsContent>
    </Tabs>
  )
}
