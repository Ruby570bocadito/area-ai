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
      {active && (
        <span
          className={cn(
            'conic-ring absolute -inset-[3px] rounded-full',
            isRed ? 'conic-ring-red' : 'conic-ring-blue'
          )}
        />
      )}
      {active && (
        <motion.span
          className={cn('absolute inset-0 rounded-full', isRed ? 'bg-[#f4536e]/20' : 'bg-[#41c0ef]/20')}
          animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <motion.div
        animate={
          active
            ? { scale: [1, 1.09, 1], rotate: [0, isRed ? -2 : 2, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 1.1, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        className={cn(
          'relative flex h-full w-full items-center justify-center border transition-colors',
          isRed
            ? 'border-[#f4536e]/60 bg-[#170b11] text-[#f4536e]'
            : 'border-[#41c0ef]/60 bg-[#0a1420] text-[#41c0ef]',
          active && (isRed ? 'active-red' : 'active-blue')
        )}
        style={{
          clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)',
          clipRule: 'nonzero',
        }}
      >
        <AgentIcon icon={agent.icon} className={size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} />
      </motion.div>
      <span
        className={cn(
          'absolute -bottom-1.5 -right-1.5 rounded-full border px-1.5 py-px font-mono-tight text-[9px] font-bold',
          isRed
            ? 'border-[#f4536e]/50 bg-[#170b11] text-[#f98ca0]'
            : 'border-[#41c0ef]/50 bg-[#0a1420] text-[#8adcf7]'
        )}
      >
        Nv{agent.level}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tarjeta completa de agente (arena en vivo)
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
            ? '0 8px 30px -12px rgba(244,83,110,0.45)'
            : '0 8px 30px -12px rgba(65,192,239,0.45)'
          : '0 0 0 rgba(0,0,0,0)',
      }}
      className={cn(
        'panel relative overflow-hidden rounded-xl p-3 transition-colors',
        active && (isRed ? 'active-red' : 'active-blue')
      )}
    >
      {active && (
        <span
          className={cn(
            'absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            isRed ? 'bg-[#f4536e]/15 text-[#f98ca0]' : 'bg-[#41c0ef]/15 text-[#8adcf7]'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full anim-blink', isRed ? 'bg-[#f4536e]' : 'bg-[#41c0ef]')} />
          Actuando
        </span>
      )}
      <div className="flex items-center gap-3">
        <AgentAvatar agent={agent} active={active} />
        <div className="min-w-0">
          <p
            className={cn(
              'font-display truncate text-sm font-bold tracking-wide',
              isRed ? 'text-[#f98ca0]' : 'text-[#8adcf7]'
            )}
          >
            {agent.codename}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{agent.role}</p>
        </div>
      </div>
      {lastAction && (
        <p className="mt-2 truncate rounded-md bg-white/[0.04] px-2 py-1 text-[11px] italic text-foreground/80">
          “{lastAction}”
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className={cn('h-full rounded-full', isRed ? 'bg-[#f4536e]' : 'bg-[#41c0ef]')}
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
