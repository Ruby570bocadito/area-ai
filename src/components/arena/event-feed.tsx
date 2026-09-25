'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Zap,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Radar,
  Swords,
  Skull,
  Eye,
  Lock,
  Flag,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDTO } from '@/lib/api-types'

const RESULT_STYLE: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  EXITO: { label: 'ÉXITO', cls: 'bg-[#ff3355]/15 text-[#ff8299] border-[#ff3355]/40', icon: Zap },
  PARCIAL: { label: 'PARCIAL', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: AlertTriangle },
  FALLO: { label: 'FALLO', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40', icon: ShieldX },
  BLOQUEADO: { label: 'BLOQUEADO', cls: 'bg-[#22d3ee]/15 text-[#7ee7f9] border-[#22d3ee]/40', icon: ShieldCheck },
  DETECTADO: { label: 'DETECTADO', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', icon: Eye },
  CONTENIDO: { label: 'CONTENIDO', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/40', icon: Lock },
  IGNORADO: { label: 'IGNORADO', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: AlertTriangle },
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'text-muted-foreground',
  LOW: 'text-slate-300',
  MEDIUM: 'text-amber-300',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-[#ff5f7a]',
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
        'nice-scroll relative overflow-y-auto rounded-xl border border-[#1c2b4a] bg-black/40 p-2',
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
                'anim-rise mb-1.5 flex gap-2 rounded-lg border p-2',
                isRed
                  ? 'border-[#ff3355]/25 bg-[#ff3355]/[0.05]'
                  : isBlue
                    ? 'border-[#22d3ee]/25 bg-[#22d3ee]/[0.05]'
                    : 'border-[#fbbf24]/25 bg-[#fbbf24]/[0.05]'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono-tight text-[9px] font-bold',
                  isRed
                    ? 'border-[#ff3355]/50 bg-[#14060c] text-[#ff6b85]'
                    : isBlue
                      ? 'border-[#22d3ee]/50 bg-[#04141b] text-[#67e8f9]'
                      : 'border-[#fbbf24]/50 bg-[#171203] text-amber-300'
                )}
              >
                {isRed ? <Swords className="h-3 w-3" /> : isBlue ? <ShieldCheck className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'font-mono-tight text-[11px] font-bold tracking-wide',
                      isRed ? 'text-[#ff8299]' : isBlue ? 'text-[#7ee7f9]' : 'text-amber-300'
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
                    <span className="rounded bg-white/5 px-1.5 py-px font-mono-tight text-[9px] text-muted-foreground">
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
