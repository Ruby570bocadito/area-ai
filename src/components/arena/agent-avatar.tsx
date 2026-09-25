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
} from 'react-icons/fa6'
import type { IconType } from 'react-icons'
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
          className={cn('absolute inset-0 rounded-full', isRed ? 'bg-[#d92d20]/20' : 'bg-[#0086c9]/20')}
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
            ? 'border-[#fda29b] bg-[#fef3f2] text-[#d92d20]'
            : 'border-[#84caff] bg-[#f0f9ff] text-[#0086c9]',
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
          'absolute -bottom-1.5 -right-1.5 rounded-full border px-1.5 py-px font-mono-tight text-[9px] font-bold shadow-sm',
          isRed
            ? 'border-[#fecdca] bg-white text-[#b42318]'
            : 'border-[#b2ddff] bg-white text-[#026aa2]'
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
            ? '0 8px 24px -12px rgba(217, 45, 32, 0.4)'
            : '0 8px 24px -12px rgba(0, 134, 201, 0.4)'
          : '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
      className={cn(
        'panel relative overflow-hidden rounded-xl p-3 transition-colors',
        active && (isRed ? 'active-red scan-sweep' : 'active-blue scan-sweep')
      )}
    >
      {active && (
        <span
          className={cn(
            'absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            isRed ? 'bg-[#fef3f2] text-[#b42318]' : 'bg-[#f0f9ff] text-[#026aa2]'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full pulse-dot', isRed ? 'bg-[#d92d20]' : 'bg-[#0086c9]')} />
          Actuando
        </span>
      )}
      <div className="flex items-center gap-3">
        <AgentAvatar agent={agent} active={active} />
        <div className="min-w-0">
          <p
            className={cn(
              'font-display truncate text-sm font-bold tracking-wide',
              isRed ? 'text-[#b42318]' : 'text-[#026aa2]'
            )}
          >
            {agent.codename}
          </p>
          <p className="truncate text-[11px] text-ink-500">{agent.role}</p>
        </div>
      </div>
      {lastAction && (
        <motion.p
          key={lastAction}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="mt-2 truncate rounded-md bg-[#f9fafb] px-2 py-1 text-[11px] italic text-[#475467]"
        >
          “{lastAction}”
        </motion.p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
          <motion.div
            className={cn('h-full rounded-full', isRed ? 'bg-[#d92d20]' : 'bg-[#0086c9]')}
            initial={{ width: 0 }}
            animate={{ width: `${xpPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono-tight text-[10px] text-ink-500">
          {agent.xp} XP · {agent.victories}🏆
        </span>
      </div>
    </motion.div>
  )
}
