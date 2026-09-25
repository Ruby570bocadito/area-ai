'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Zap,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Swords,
  Eye,
  Lock,
  Flag,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDTO } from '@/lib/api-types'

const RESULT_STYLE: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  EXITO: { label: 'ÉXITO', cls: 'bg-[#f4536e]/12 text-[#f98ca0] border-[#f4536e]/35', icon: Zap },
  PARCIAL: { label: 'PARCIAL', cls: 'bg-[#e8b64c]/12 text-[#f0cd85] border-[#e8b64c]/35', icon: AlertTriangle },
  FALLO: { label: 'FALLO', cls: 'bg-white/[0.06] text-white/60 border-white/15', icon: ShieldX },
  BLOQUEADO: { label: 'BLOQUEADO', cls: 'bg-[#41c0ef]/12 text-[#8adcf7] border-[#41c0ef]/35', icon: ShieldCheck },
  DETECTADO: { label: 'DETECTADO', cls: 'bg-[#4ad6a5]/12 text-[#7fe8c4] border-[#4ad6a5]/35', icon: Eye },
  CONTENIDO: { label: 'CONTENIDO', cls: 'bg-[#a78bfa]/12 text-[#cbb8f8] border-[#a78bfa]/35', icon: Lock },
  IGNORADO: { label: 'IGNORADO', cls: 'bg-[#e8b64c]/12 text-[#f0cd85] border-[#e8b64c]/35', icon: AlertTriangle },
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'text-muted-foreground',
  LOW: 'text-white/55',
  MEDIUM: 'text-[#f0cd85]',
  HIGH: 'text-[#f5a05e]',
  CRITICAL: 'text-[#f98ca0]',
}

export function EventFeed({
  events,
  className,
  max = 60,
}: {
  events: EventDTO[]
  className?: string
  max?: number
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const shown = events.slice(-max)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [shown.length])

  return (
    <div
      ref={scrollRef}
      className={cn(
        'nice-scroll panel relative overflow-y-auto rounded-xl p-2',
        className
      )}
      role="log"
      aria-label="Registro de eventos de la campaña"
    >
      <AnimatePresence initial={false}>
        {shown.map((ev) => {
          const isRed = ev.team === 'RED'
          const isBlue = ev.team === 'BLUE'
          const res = ev.result ? RESULT_STYLE[ev.result] : null
          const ResIcon = res?.icon
          return (
            <motion.div
              key={ev.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className={cn(
                'anim-rise relative mb-1.5 flex gap-2.5 overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5 pl-3',
              )}
            >
              {/* acento lateral por equipo */}
              <span
                className={cn(
                  'absolute inset-y-0 left-0 w-[2.5px]',
                  isRed ? 'bg-[#f4536e]/70' : isBlue ? 'bg-[#41c0ef]/70' : 'bg-[#e8b64c]/70'
                )}
              />
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono-tight text-[9px] font-bold',
                  isRed
                    ? 'border-[#f4536e]/40 bg-[#f4536e]/[0.08] text-[#f98ca0]'
                    : isBlue
                      ? 'border-[#41c0ef]/40 bg-[#41c0ef]/[0.08] text-[#8adcf7]'
                      : 'border-[#e8b64c]/40 bg-[#e8b64c]/[0.08] text-[#f0cd85]'
                )}
              >
                {isRed ? <Swords className="h-3 w-3" /> : isBlue ? <ShieldCheck className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'font-mono-tight text-[11px] font-bold tracking-wide',
                      isRed ? 'text-[#f98ca0]' : isBlue ? 'text-[#8adcf7]' : 'text-[#f0cd85]'
                    )}
                  >
                    {ev.agentCodename ?? 'SISTEMA'}
                  </span>
                  <span className={cn('font-mono-tight text-[9px] uppercase', SEVERITY_COLOR[ev.severity] ?? 'text-muted-foreground')}>
                    R{ev.round}·{ev.phase}
                  </span>
                  {res && ResIcon && (
                    <span className={cn('flex items-center gap-1 rounded border px-1.5 py-px font-mono-tight text-[9px] font-bold', res.cls)}>
                      <ResIcon className="h-2.5 w-2.5" />
                      {res.label}
                      {ev.impact > 0 && ` +${ev.impact}`}
                    </span>
                  )}
                  {ev.targetNode && (
                    <span className="rounded bg-white/[0.05] px-1.5 py-px font-mono-tight text-[9px] text-muted-foreground">
                      → {ev.targetNode}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug text-foreground/90">{ev.action}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{ev.detail}</p>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      {shown.length === 0 && (
        <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Info className="h-5 w-5" />
          <p className="text-xs">Esperando que comience la primera campaña…</p>
        </div>
      )}
    </div>
  )
}
