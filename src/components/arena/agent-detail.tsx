'use client'

import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trophy, Swords, GraduationCap, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import type { AgentDTO } from '@/lib/api-types'

const XP_PER_LEVEL = 80

// ─────────────────────────────────────────────────────────────
// Ficha de agente — dialog premium con estadísticas completas
// ─────────────────────────────────────────────────────────────
export function AgentDetailDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: AgentDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!agent) return null
  const isRed = agent.team === 'RED'
  const accent = isRed ? '#f4536e' : '#41c0ef'
  const winRate = agent.campaigns > 0 ? Math.round((agent.victories / agent.campaigns) * 100) : 0
  const xpIntoLevel = agent.xp % XP_PER_LEVEL
  const xpPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md gap-0 overflow-hidden border-white/10 bg-[#0b0d13] p-0">
        {/* Cabecera con aura de equipo */}
        <div className="relative overflow-hidden p-6 pb-5">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.14] blur-3xl"
            style={{ background: accent }}
          />
          <div
            className="pointer-events-none absolute left-0 top-0 h-full w-[3px]"
            style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}
          />
          <DialogHeader>
            <DialogTitle className="sr-only">{agent.codename}</DialogTitle>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-4"
            >
              <motion.div
                initial={{ scale: 0.7, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <AgentAvatar agent={agent} size="lg" active />
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-display truncate text-lg font-extrabold tracking-tight', isRed ? 'text-[#f98ca0]' : 'text-[#8adcf7]')}>
                    {agent.codename}
                  </h3>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 font-mono-tight text-[9px] font-bold tracking-wider',
                      isRed ? 'border-[#f4536e]/35 bg-[#f4536e]/[0.08] text-[#f98ca0]' : 'border-[#41c0ef]/35 bg-[#41c0ef]/[0.08] text-[#8adcf7]'
                    )}
                  >
                    {agent.team}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] font-medium text-foreground/85">{agent.role}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[11.5px] italic text-muted-foreground">
                  <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                  {agent.specialty}
                </p>
              </div>
            </motion.div>
          </DialogHeader>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-6">
          {[
            { icon: Swords, label: 'Campañas', value: agent.campaigns, color: 'text-foreground' },
            { icon: Trophy, label: 'Victorias', value: agent.victories, color: 'text-[#4ad6a5]' },
            { icon: GraduationCap, label: 'Nivel', value: agent.level, color: 'text-[#f0cd85]' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center"
            >
              <s.icon className={cn('mx-auto h-3.5 w-3.5', s.color)} />
              <p className={cn('font-display mt-1 text-lg font-extrabold', s.color)}>{s.value}</p>
              <p className="font-mono-tight text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* XP + winrate */}
        <div className="space-y-3 px-6 pt-4">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono-tight text-[10px] text-muted-foreground">
              <span>Progreso a nivel {agent.level + 1}</span>
              <span>
                {xpIntoLevel}/{XP_PER_LEVEL} XP
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${accent}88, ${accent})` }}
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono-tight text-[10px] text-muted-foreground">
              <span>Tasa de victorias</span>
              <span>{winRate}%</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full bg-[#4ad6a5]"
                initial={{ width: 0 }}
                animate={{ width: `${winRate}%` }}
                transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Descripción */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="border-t border-white/[0.06] mt-4 px-6 py-4 text-[12px] leading-relaxed text-muted-foreground"
        >
          {agent.description}
        </motion.p>
      </DialogContent>
    </Dialog>
  )
}
