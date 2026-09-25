'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import { AgentDetailDialog } from './agent-detail'
import type { AgentDTO } from '@/lib/api-types'

const SPOTLIGHT_MOVE = (e: React.MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function RosterCard({ agent, index, onSelect }: { agent: AgentDTO; index: number; onSelect: (a: AgentDTO) => void }) {
  const isRed = agent.team === 'RED'
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: Math.min(index * 0.05, 0.35), duration: 0.45 }}
      whileHover={{ y: -4 }}
      onMouseMove={SPOTLIGHT_MOVE}
      onClick={() => onSelect(agent)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(agent)
      }}
      aria-label={`Ver ficha de ${agent.codename}`}
      className="panel panel-hover spot-card group relative cursor-pointer overflow-hidden rounded-xl p-4"
    >
      {/* indicador de ficha */}
      <span className="absolute right-2.5 top-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border border-surface-200 bg-white text-ink-400 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110">
        <Maximize2 className="h-2.5 w-2.5" />
      </span>
      {/* aura sutil */}
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-[0.12]',
          isRed ? 'bg-[#d92d20]' : 'bg-[#0086c9]'
        )}
      />
      <div className="flex items-start gap-3">
        <div className={cn(isRed ? 'anim-float' : '')} style={{ animationDelay: `${index * 0.2}s` }}>
          <span className="inline-block transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
            <AgentAvatar agent={agent} size="lg" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display truncate text-sm font-bold tracking-wide text-ink-900">
              {agent.codename}
            </h4>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
                isRed ? 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]' : 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]'
              )}
            >
              {isRed ? 'RED' : 'BLUE'}
            </span>
          </div>
          <p className="text-[11.5px] font-medium text-ink-700">{agent.role}</p>
          <p className="mt-0.5 text-[11px] italic text-ink-400">{agent.specialty}</p>
        </div>
      </div>
      <p className="mt-3 min-h-[48px] text-[11.5px] leading-relaxed text-ink-500">{agent.description}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-surface-100 pt-3 text-center">
        <div>
          <p className="font-mono-tight text-sm font-bold text-ink-900">{agent.campaigns}</p>
          <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Campañas</p>
        </div>
        <div>
          <p className="font-mono-tight text-sm font-bold text-[#067647]">{agent.victories}</p>
          <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Victorias</p>
        </div>
        <div>
          <p className="font-mono-tight text-sm font-bold text-[#b54708]">{agent.xp} XP</p>
          <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Nivel {agent.level}</p>
        </div>
      </div>
    </motion.article>
  )
}

export function Roster({ agents }: { agents: AgentDTO[] }) {
  const [selected, setSelected] = useState<AgentDTO | null>(null)
  const red = agents.filter((a) => a.team === 'RED')
  const blue = agents.filter((a) => a.team === 'BLUE')
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {red.map((a, i) => (
          <RosterCard key={a.key} agent={a} index={i} onSelect={setSelected} />
        ))}
        {blue.map((a, i) => (
          <RosterCard key={a.key} agent={a} index={i + red.length} onSelect={setSelected} />
        ))}
      </div>
      <AgentDetailDialog agent={selected} open={selected != null} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  )
}
