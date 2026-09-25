'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brain, Flame, Sparkles, TrendingUp } from 'lucide-react'
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
      className={cn(
        'glass relative overflow-hidden rounded-xl p-3.5 transition-shadow hover:shadow-lg',
        isRed ? 'hover:border-[#ff3355]/40' : 'hover:border-[#22d3ee]/40'
      )}
    >
      {isFresh && (
        <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 anim-blink">
          <Sparkles className="h-2.5 w-2.5" /> Nuevo
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            isRed ? 'bg-[#ff3355]/15 text-[#ff8299]' : 'bg-[#22d3ee]/15 text-[#7ee7f9]'
          )}
        >
          {CATEGORY_LABEL[k.category] ?? k.category}
        </span>
        {eff !== null && eff >= 50 && <TrendingUp className="h-3 w-3 text-emerald-400" />}
      </div>
      <h4 className="mt-1.5 text-[13px] font-bold leading-snug text-foreground">{k.title}</h4>
      <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{k.content}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {k.tags
          .split(',')
          .filter(Boolean)
          .slice(0, 4)
          .map((t) => (
            <span key={t} className="rounded bg-white/5 px-1.5 py-px font-mono-tight text-[9px] text-muted-foreground">
              #{t.trim()}
            </span>
          ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Brain className={cn('h-3.5 w-3.5', isRed ? 'text-[#ff3355]' : 'text-[#22d3ee]')} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
          <motion.div
            className={cn('h-full rounded-full', isRed ? 'bg-gradient-to-r from-[#ff3355]/60 to-[#ff3355]' : 'bg-gradient-to-r from-[#22d3ee]/50 to-[#22d3ee]')}
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.round(k.confidence * 100)}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono-tight text-[10px] text-muted-foreground">
          {Math.round(k.confidence * 100)}% · {k.timesUsed}usos
        </span>
        {isFresh && <Flame className="h-3 w-3 text-amber-400" />}
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
      <TabsList className="grid w-full max-w-md grid-cols-2 bg-black/40">
        <TabsTrigger value="red" className="data-[state=active]:bg-[#ff3355]/20 data-[state=active]:text-[#ff8299]">
          Inteligencia RED ({red.length})
        </TabsTrigger>
        <TabsTrigger value="blue" className="data-[state=active]:bg-[#22d3ee]/20 data-[state=active]:text-[#7ee7f9]">
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
