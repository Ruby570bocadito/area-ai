'use client'

import { motion } from 'framer-motion'
import { Swords, ShieldCheck, Minus, Hourglass, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CampaignListItemDTO } from '@/lib/api-types'

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

export function HistoryPanel({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-2 rounded-xl p-8 text-center text-[#667085]">
        <History className="h-5 w-5" />
        <p className="text-sm">Aún no hay campañas finalizadas. Lanza la primera desde el panel de mando.</p>
      </div>
    )
  }
  return (
    <div className="nice-scroll max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
      {campaigns.map((c, i) => (
        <motion.article
          key={c.id}
          initial={{ opacity: 0, x: -14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4 }}
          className="panel panel-hover rounded-xl p-3.5"
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
            {c.status === 'COMPLETED' ? (
              <WinnerBadge winner={c.winner} />
            ) : c.status === 'RUNNING' ? (
              <span className="flex items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]">
                <Hourglass className="h-2.5 w-2.5 pulse-dot" /> EN CURSO
              </span>
            ) : (
              <span className="rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#667085]">
                ABORTADA
              </span>
            )}
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
        </motion.article>
      ))}
    </div>
  )
}
