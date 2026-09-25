'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import type { AgentDTO } from '@/lib/api-types'

function RosterCard({ agent, index }: { agent: AgentDTO; index: number }) {
  const isRed = agent.team === 'RED'
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: Math.min(index * 0.05, 0.35), duration: 0.45 }}
      whileHover={{ y: -4 }}
      className="panel panel-hover group relative overflow-hidden rounded-xl p-4"
    >
      {/* aura sutil */}
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20',
          isRed ? 'bg-[#f4536e]' : 'bg-[#41c0ef]'
        )}
      />
      <div className="flex items-start gap-3">
        <div className={isRed ? 'anim-float' : ''} style={{ animationDelay: `${index * 0.2}s` }}>
          <AgentAvatar agent={agent} size="lg" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display truncate text-sm font-bold tracking-wide">
              {agent.codename}
            </h4>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
                isRed ? 'border-[#f4536e]/35 bg-[#f4536e]/[0.08] text-[#f98ca0]' : 'border-[#41c0ef]/35 bg-[#41c0ef]/[0.08] text-[#8adcf7]'
              )}
            >
              {isRed ? 'RED' : 'BLUE'}
            </span>
          </div>
          <p className="text-[11.5px] font-medium text-foreground/85">{agent.role}</p>
          <p className="mt-0.5 text-[11px] italic text-muted-foreground">{agent.specialty}</p>
        </div>
      </div>
      <p className="mt-3 min-h-[48px] text-[11.5px] leading-relaxed text-muted-foreground">{agent.description}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
        <div>
          <p className="font-mono-tight text-sm font-bold text-foreground">{agent.campaigns}</p>
          <p className="font-mono-tight text-[9px] uppercase tracking-wider text-muted-foreground">Campañas</p>
        </div>
        <div>
          <p className="font-mono-tight text-sm font-bold text-[#4ad6a5]">{agent.victories}</p>
          <p className="font-mono-tight text-[9px] uppercase tracking-wider text-muted-foreground">Victorias</p>
        </div>
        <div>
          <p className="font-mono-tight text-sm font-bold text-[#f0cd85]">{agent.xp} XP</p>
          <p className="font-mono-tight text-[9px] uppercase tracking-wider text-muted-foreground">Nivel {agent.level}</p>
        </div>
      </div>
    </motion.article>
  )
}

export function Roster({ agents }: { agents: AgentDTO[] }) {
  const red = agents.filter((a) => a.team === 'RED')
  const blue = agents.filter((a) => a.team === 'BLUE')
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {red.map((a, i) => (
        <RosterCard key={a.key} agent={a} index={i} />
      ))}
      {blue.map((a, i) => (
        <RosterCard key={a.key} agent={a} index={i + red.length} />
      ))}
    </div>
  )
}
