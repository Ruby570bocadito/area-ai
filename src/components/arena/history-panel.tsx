'use client'

import { motion } from 'framer-motion'
import { Swords, ShieldCheck, Minus, Hourglass, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CampaignListItemDTO } from '@/lib/api-types'

function WinnerBadge({ winner }: { winner: string | null }) {
  if (winner === 'RED')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#ff3355]/40 bg-[#ff3355]/10 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#ff8299]">
        <Swords className="h-2.5 w-2.5" /> GANA RED
      </span>
    )
  if (winner === 'BLUE')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#7ee7f9]">
        <ShieldCheck className="h-2.5 w-2.5" /> GANA BLUE
      </span>
    )
  return (
    <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-amber-300">
      <Minus className="h-2.5 w-2.5" /> EMPATE
    </span>
  )
}

export function HistoryPanel({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-xl p-8 text-center text-muted-foreground">
        <History className="h-5 w-5" />
        <p className="text-sm">Aún no hay campañas finalizadas. Lanza la primera desde el centro de control.</p>
      </div>
    )
  }
  return (
    <div className="nice-scroll max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
      {campaigns.map((c, i) => (
        <motion.article
          key={c.id}
          initial={{ opacity: 0, x: -14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4 }}
          className="glass rounded-xl p-3.5 transition-colors hover:border-[#a755ff]/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono-tight text-[12px] font-bold tracking-wider text-foreground">
                {c.scenario.codename}
                <span className="ml-2 font-normal text-muted-foreground">· {c.scenario.company}</span>
              </p>
              <p className="text-[10.5px] text-muted-foreground">
                {new Date(c.startedAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · dificultad {c.scenario.difficulty}/5
              </p>
            </div>
            {c.status === 'COMPLETED' ? (
              <WinnerBadge winner={c.winner} />
            ) : c.status === 'RUNNING' ? (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-amber-300">
                <Hourglass className="h-2.5 w-2.5 anim-blink" /> EN CURSO
              </span>
            ) : (
              <span className="rounded-full border border-[#1c2b4a] bg-black/40 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-muted-foreground">
                ABORTADA
              </span>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-10 font-mono-tight text-[10px] text-[#ff8299]">RED {c.redProgress}%</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${c.redProgress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7 }}
                  className="h-full rounded-full bg-[#ff3355]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 font-mono-tight text-[10px] text-[#7ee7f9]">BLU {c.blueProgress}%</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${c.blueProgress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7 }}
                  className="h-full rounded-full bg-[#22d3ee]"
                />
              </div>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  )
}
