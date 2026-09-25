'use client'

import { motion } from 'framer-motion'
import {
  FaSkull,
  FaSatelliteDish,
  FaCrosshairs,
  FaCodeBranch,
  FaUserNinja,
  FaShieldHalved,
  FaHeartPulse,
  FaLock,
  FaEye,
  FaBinoculars,
  FaUserSecret,
  FaShieldHeart,
  type IconType,
} from 'react-icons/fa6'
import { cn } from '@/lib/utils'
import type { AgentDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Repositorio de iconos por agente (react-icons / Font Awesome 6)
// ─────────────────────────────────────────────────────────────
const ICONS: Record<string, IconType> = {
  skull: FaSkull,
  radar: FaSatelliteDish,
  crosshair: FaCrosshairs,
  gitbranch: FaCodeBranch,
  ghost: FaUserNinja,
  shield: FaShieldHalved,
  activity: FaHeartPulse,
  lock: FaLock,
  eye: FaEye,
  flashlight: FaBinoculars,
  secret: FaUserSecret,
  shieldheart: FaShieldHeart,
}

export function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? FaShieldHalved
  return <Icon className={className} />
}

// ─────────────────────────────────────────────────────────────
// Avatar hexagonal con anillo cónico giratorio (estado activo)
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
      {/* anillo cónico giratorio cuando actúa */}
      {active && (
        <span
          className={cn(
            'conic-ring absolute -inset-[3px] rounded-full',
            isRed ? 'conic-ring-red' : 'conic-ring-cyan'
          )}
        />
      )}
      {/* halo de pulso (framer-motion) */}
      {active && (
        <motion.span
          className={cn('absolute inset-0 rounded-full', isRed ? 'bg-[#ff3355]/20' : 'bg-[#22d3ee]/20')}
          animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      {/* hexágono con icono */}
      <motion.div
        animate={
          active
            ? { scale: [1, 1.09, 1], rotate: [0, isRed ? -2 : 2, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 1.1, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        className={cn(
          'relative flex h-full w-full items-center justify-center border-2 transition-colors',
          isRed
            ? 'border-[#ff3355]/70 bg-[#1a0a12] text-[#ff3355]'
            : 'border-[#22d3ee]/70 bg-[#071720] text-[#22d3ee]',
          active && (isRed ? 'glow-red' : 'glow-cyan')
        )}
        style={{
          clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)',
          clipRule: 'nonzero',
        }}
      >
        <AgentIcon icon={agent.icon} className={size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5.5 w-5.5'} />
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
              'truncate font-display text-sm font-bold tracking-wide',
              isRed ? 'text-[#ff6b85]' : 'text-[#67e8f9]'
            )}
          >
            {agent.codename}
          </p>
          <p className="truncate font-grotesk text-[11px] text-muted-foreground">{agent.role}</p>
        </div>
      </div>
      {lastAction && (
        <p className="mt-2 truncate rounded-md bg-black/30 px-2 py-1 font-grotesk text-[11px] italic text-foreground/80">
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
