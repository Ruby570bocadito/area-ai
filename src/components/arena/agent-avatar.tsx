'use client'

import { motion } from 'framer-motion'
import {
  Skull,
  Radar,
  Crosshair,
  GitBranch,
  Ghost,
  Shield,
  Activity,
  Lock,
  Eye,
  Flashlight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentDTO } from '@/lib/api-types'

const ICONS: Record<string, LucideIcon> = {
  skull: Skull,
  radar: Radar,
  crosshair: Crosshair,
  gitbranch: GitBranch,
  ghost: Ghost,
  shield: Shield,
  activity: Activity,
  lock: Lock,
  eye: Eye,
  flashlight: Flashlight,
}

export function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Shield
  return <Icon className={className} />
}

// ─────────────────────────────────────────────────────────────
// Avatar hexagonal animado por agente
// ─────────────────────────────────────────────────────────────
export function AgentAvatar({
  agent,
  active,
  size = 'md',
}: {
  agent: Pick<AgentDTO, 'codename' | 'icon' | 'team' | 'level'>
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const isRed = agent.team === 'RED'
  const dim = size === 'lg' ? 64 : size === 'sm' ? 38 : 50

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      {/* anillo pulsante cuando el agente está actuando */}
      {active && (
        <span
          className={cn(
            'absolute inset-0 rounded-[30%]',
            isRed ? 'pulse-ring-red' : 'pulse-ring-cyan'
          )}
        />
      )}
      {/* hexágono */}
      <motion.div
        animate={
          active
            ? { scale: [1, 1.08, 1], rotate: [0, isRed ? -2 : 2, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 1.1, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-[30%] border-2 transition-colors',
          isRed
            ? 'border-[#ff3355]/70 bg-[#1a0a12] text-[#ff3355]'
            : 'border-[#22d3ee]/70 bg-[#071720] text-[#22d3ee]',
          active && (isRed ? 'glow-red' : 'glow-cyan')
        )}
        style={{ clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)' }}
      >
        <AgentIcon icon={agent.icon} className={size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'} />
      </motion.div>
      {/* nivel */}
      <span
        className={cn(
          'absolute -bottom-1.5 -right-1.5 rounded-full border px-1.5 py-px text-[9px] font-bold font-mono-tight',
          isRed
            ? 'border-[#ff3355]/60 bg-[#14060c] text-[#ff6b85]'
            : 'border-[#22d3ee]/60 bg-[#04141b] text-[#67e8f9]'
        )}
      >
        Nv{agent.level}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tarjeta completa de agente (roster / arena)
// ─────────────────────────────────────────────────────────────
export function AgentCard({
  agent,
  active,
  lastAction,
}: {
  agent: AgentDTO
  active?: boolean
  lastAction?: string | null
}) {
  const isRed = agent.team === 'RED'
  const xpForLevel = 80
  const xpPct = Math.min(100, Math.round(((agent.xp % xpForLevel) / xpForLevel) * 100))

  return (
    <motion.div
      layout
      animate={{
        boxShadow: active
          ? isRed
            ? '0 0 26px rgba(255,51,85,0.35)'
            : '0 0 26px rgba(34,211,238,0.35)'
          : '0 0 0 rgba(0,0,0,0)',
      }}
      className={cn(
        'glass relative overflow-hidden rounded-xl p-3 transition-colors',
        active && (isRed ? 'border-[#ff3355]/60' : 'border-[#22d3ee]/60')
      )}
    >
      {active && (
        <span
          className={cn(
            'absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
            isRed ? 'bg-[#ff3355]/15 text-[#ff8299]' : 'bg-[#22d3ee]/15 text-[#7ee7f9]'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full anim-blink', isRed ? 'bg-[#ff3355]' : 'bg-[#22d3ee]')} />
          Actuando
        </span>
      )}
      <div className="flex items-center gap-3">
        <AgentAvatar agent={agent} active={active} />
        <div className="min-w-0">
          <p
            className={cn(
              'truncate text-sm font-bold font-mono-tight tracking-wide',
              isRed ? 'text-[#ff6b85]' : 'text-[#67e8f9]'
            )}
          >
            {agent.codename}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{agent.role}</p>
        </div>
      </div>
      {lastAction && (
        <p className="mt-2 truncate rounded-md bg-black/30 px-2 py-1 text-[11px] italic text-foreground/80">
          “{lastAction}”
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
          <motion.div
            className={cn('h-full rounded-full', isRed ? 'bg-[#ff3355]' : 'bg-[#22d3ee]')}
            initial={{ width: 0 }}
            animate={{ width: `${xpPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono-tight text-[10px] text-muted-foreground">
          {agent.xp} XP · {agent.victories}🏆
        </span>
      </div>
    </motion.div>
  )
}
