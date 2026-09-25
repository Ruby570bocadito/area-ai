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
  EXITO: { label: 'ÉXITO', cls: 'bg-[#fef3f2] text-[#b42318] border-[#fecdca]', icon: Zap },
  PARCIAL: { label: 'PARCIAL', cls: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]', icon: AlertTriangle },
  FALLO: { label: 'FALLO', cls: 'bg-[#f9fafb] text-[#667085] border-[#e4e7ec]', icon: ShieldX },
  BLOQUEADO: { label: 'BLOQUEADO', cls: 'bg-[#f0f9ff] text-[#026aa2] border-[#b2ddff]', icon: ShieldCheck },
  DETECTADO: { label: 'DETECTADO', cls: 'bg-[#ecfdf3] text-[#067647] border-[#a6f4c5]', icon: Eye },
  CONTENIDO: { label: 'CONTENIDO', cls: 'bg-[#f5f3ff] text-[#6941c6] border-[#ddd6fe]', icon: Lock },
  IGNORADO: { label: 'IGNORADO', cls: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]', icon: AlertTriangle },
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'text-[#98a2b3]',
  LOW: 'text-[#98a2b3]',
  MEDIUM: 'text-[#b54708]',
  HIGH: 'text-[#b93815]',
  CRITICAL: 'text-[#b42318]',
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
              initial={{ opacity: 0, y: 14, scale: 0.98, boxShadow: '0 2px 12px -4px rgba(16,24,40,0.18)' }}
              animate={{ opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, boxShadow: { duration: 1.6, ease: 'easeOut' } }}
              className={cn(
                'anim-rise relative mb-1.5 flex gap-2.5 overflow-hidden rounded-lg border border-[#f2f4f7] bg-[#f9fafb] p-2.5 pl-3',
              )}
            >
              {/* acento lateral por equipo */}
              <span
                className={cn(
                  'absolute inset-y-0 left-0 w-[2.5px]',
                  isRed ? 'bg-[#d92d20]/70' : isBlue ? 'bg-[#0086c9]/70' : 'bg-[#d97706]/70'
                )}
              />
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono-tight text-[9px] font-bold',
                  isRed
                    ? 'border-[#fecdca] bg-white text-[#b42318]'
                    : isBlue
                      ? 'border-[#b2ddff] bg-white text-[#026aa2]'
                      : 'border-[#fedf89] bg-white text-[#b54708]'
                )}
              >
                {isRed ? <Swords className="h-3 w-3" /> : isBlue ? <ShieldCheck className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'font-mono-tight text-[11px] font-bold tracking-wide',
                      isRed ? 'text-[#b42318]' : isBlue ? 'text-[#026aa2]' : 'text-[#b54708]'
                    )}
                  >
                    {ev.agentCodename ?? 'SISTEMA'}
                  </span>
                  <span className={cn('font-mono-tight text-[9px] uppercase', SEVERITY_COLOR[ev.severity] ?? 'text-[#98a2b3]')}>
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
                    <span className="rounded bg-[#f2f4f7] px-1.5 py-px font-mono-tight text-[9px] text-[#667085]">
                      → {ev.targetNode}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug text-[#101828]">{ev.action}</p>
                <p className="text-[11px] leading-snug text-[#667085]">{ev.detail}</p>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      {shown.length === 0 && (
        <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-[#98a2b3]">
          <Info className="h-5 w-5" />
          <p className="text-xs">Sin eventos todavía — las acciones de los agentes aparecerán aquí.</p>
        </div>
      )}
    </div>
  )
}
