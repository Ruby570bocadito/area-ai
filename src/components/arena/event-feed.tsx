'use client'

import { useEffect, useRef, useState } from 'react'
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
  Link2,
  Check,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyTextToClipboard } from '@/lib/download'
import type { EventDTO } from '@/lib/api-types'

const RESULT_STYLE: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  EXITO: { label: 'SUCCESS', cls: 'bg-[#fef3f2] text-[#b42318] border-[#fecdca]', icon: Zap },
  PARCIAL: { label: 'PARTIAL', cls: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]', icon: AlertTriangle },
  FALLO: { label: 'FAILED', cls: 'bg-surface-50 text-ink-500 border-surface-200', icon: ShieldX },
  BLOQUEADO: { label: 'BLOCKED', cls: 'bg-[#f0f9ff] text-[#026aa2] border-[#b2ddff]', icon: ShieldCheck },
  DETECTADO: { label: 'DETECTED', cls: 'bg-[#ecfdf3] text-[#067647] border-[#a6f4c5]', icon: Eye },
  CONTENIDO: { label: 'CONTAINED', cls: 'bg-[#f5f3ff] text-[#6941c6] border-[#ddd6fe]', icon: Lock },
  ENDURECIDO: { label: 'HARDENED', cls: 'bg-[#f0f9ff] text-[#026aa2] border-[#b2ddff]', icon: ShieldCheck },
  IGNORADO: { label: 'IGNORED', cls: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]', icon: AlertTriangle },
}

interface EvidenceParsed {
  exchanges?: Array<{ method: string; path: string; status: number; ms: number; res?: string }>
  artifacts?: string[]
  detections?: string[]
}

function parseEvidence(raw: string | null): EvidenceParsed | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as EvidenceParsed
    return p && (p.exchanges?.length || p.artifacts?.length) ? p : null
  } catch {
    return null
  }
}

function statusTone(status: number): string {
  if (status === 0) return 'bg-surface-50 text-ink-500 border-surface-200'
  if (status < 300) return 'bg-[#ecfdf3] text-[#067647] border-[#a6f4c5]'
  if (status < 400) return 'bg-[#f0f9ff] text-[#026aa2] border-[#b2ddff]'
  return 'bg-[#fef3f2] text-[#b42318] border-[#fecdca]'
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'text-ink-400',
  LOW: 'text-ink-400',
  MEDIUM: 'text-[#b54708]',
  HIGH: 'text-[#b93815]',
  CRITICAL: 'text-[#b42318]',
}

// ─────────────────────────────────────────────────────────────
// EventFeed — registro de eventos de la campaña.
// enlace-permanente-ronda: props OPCIONALES para el deep-link de la
// ficha — anchorSeq centra y destaca ese evento (aro ámbar) y amplía
// la ventana de 60 para incluirlo; linkToEventBase (p. ej.
// "/historial/cmb123", solo la ficha) activa el botón «copiar
// enlace» de cada evento, que pone en el portapapeles la URL
// exacta ?evento=SEQ. Mientras hay ancla, el auto-scroll a «lo
// último» se pausa para no arrastrar la vista fuera del ancla.
// ─────────────────────────────────────────────────────────────

export function EventFeed({
  events,
  className,
  max = 60,
  anchorSeq = null,
  linkToEventBase = null,
}: {
  events: EventDTO[]
  className?: string
  max?: number
  /** Deep-link: seq del evento a centrar y destacar (null = sin ancla). */
  anchorSeq?: number | null
  /** Base de URL para el botón «copiar enlace» por evento (null = desactivado). */
  linkToEventBase?: string | null
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [copiedSeq, setCopiedSeq] = useState<number | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  // Resolución del ancla como ESTADO DERIVADO (sin efectos): si la seq
  // del enlace ya no existe (evento borrado, enlace manipulado) cae
  // en silencio al comportamiento por defecto.
  const anchorIdx = anchorSeq != null ? events.findIndex((e) => e.seq === anchorSeq) : -1
  const hasAnchor = anchorIdx >= 0
  // La ventana por defecto muestra los 60 últimos; un deep-link a un
  // evento antiguo caería fuera — se amplía hasta incluirlo.
  const effectiveMax = hasAnchor ? Math.max(max, events.length - anchorIdx) : max
  const shown = events.slice(-effectiveMax)
  const anchorKey = hasAnchor ? anchorSeq : null

  // Auto-scroll a «lo último» (comportamiento original), en pausa
  // mientras el ancla dirige la vista.
  useEffect(() => {
    if (anchorKey != null) return
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [shown.length, anchorKey])

  // Ancla: centrar en el evento enlazado (incluye el scroll de la
  // página hasta el propio feed, por el ancestro con scroll).
  useEffect(() => {
    if (anchorKey == null) return
    anchorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [anchorKey])

  const handleCopyEventLink = async (seq: number) => {
    if (!linkToEventBase) return
    const ok = await copyTextToClipboard(
      `${window.location.origin}${linkToEventBase}?evento=${seq}`
    )
    if (ok) {
      setCopiedSeq(seq)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopiedSeq(null), 1600)
    }
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'nice-scroll panel relative overflow-y-auto rounded-xl p-2',
        className
      )}
      role="log"
      aria-label="Campaign event log"
    >
      <AnimatePresence initial={false}>
        {shown.map((ev) => {
          const isRed = ev.team === 'RED'
          const isBlue = ev.team === 'BLUE'
          const res = ev.result ? RESULT_STYLE[ev.result] : null
          const ResIcon = res?.icon
          const evidence = parseEvidence(ev.evidence)
          return (
            <motion.div
              key={ev.id}
              layout
              id={`evento-${ev.seq}`}
              ref={hasAnchor && ev.seq === anchorSeq ? anchorRef : undefined}
              initial={{ opacity: 0, y: 14, scale: 0.98, boxShadow: '0 2px 12px -4px rgba(16,24,40,0.18)' }}
              animate={{ opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, boxShadow: { duration: 1.6, ease: 'easeOut' } }}
              className={cn(
                'anim-rise group relative mb-1.5 flex gap-2.5 overflow-hidden rounded-lg border border-surface-100 bg-surface-50 p-2.5 pl-3',
                hasAnchor && ev.seq === anchorSeq && 'border-[#fec84b] bg-[#fffaeb] ring-2 ring-[#fec84b]/40',
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
                    {ev.agentCodename ?? 'SYSTEM'}
                  </span>
                  <span className={cn('font-mono-tight text-[9px] uppercase', SEVERITY_COLOR[ev.severity] ?? 'text-ink-400')}>
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
                    <span className="rounded bg-surface-100 px-1.5 py-px font-mono-tight text-[9px] text-ink-500">
                      → {ev.targetNode}
                    </span>
                  )}
                  {linkToEventBase && (
                    <button
                      type="button"
                      onClick={() => handleCopyEventLink(ev.seq)}
                      aria-label={`Copy a link to event ${ev.seq} (round ${ev.round})`}
                      title="Copy a link to this exact event"
                      className="ml-auto shrink-0 rounded p-0.5 text-ink-300 opacity-0 transition-opacity focus-visible:opacity-100 hover:bg-surface-100 hover:text-ink-600 group-hover:opacity-100"
                    >
                      {copiedSeq === ev.seq ? <Check className="h-3 w-3 text-[#067647]" /> : <Link2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ink-900">{ev.action}</p>
                <p className="text-[11px] leading-snug text-ink-500">{ev.detail}</p>
                {ev.command && (
                  <div className="mt-1.5 overflow-hidden rounded-md border border-surface-200 bg-white">
                    <div className="flex items-center gap-1.5 border-b border-surface-100 px-2 py-1">
                      <TerminalSquare className="h-3 w-3 shrink-0 text-ink-400" />
                      <span className="font-mono-tight text-[8.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
                        real command · laboratory
                      </span>
                      {evidence?.exchanges && evidence.exchanges.length > 0 && (
                        <span className="ml-auto flex items-center gap-1">
                          {evidence.exchanges.slice(0, 4).map((x, i) => (
                            <span
                              key={i}
                              className={cn('rounded border px-1 font-mono-tight text-[8.5px] font-bold', statusTone(x.status))}
                              title={`${x.method} ${x.path} → ${x.status} (${x.ms}ms)${x.res ? ` · ${x.res}` : ''}`}
                            >
                              {x.status || 'ERR'}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="truncate px-2 py-1 font-mono-tight text-[10px] leading-relaxed text-ink-700" title={ev.command}>
                      {ev.command}
                    </p>
                  </div>
                )}
                {evidence?.artifacts && evidence.artifacts.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {evidence.artifacts.slice(0, 3).map((a, i) => (
                      <span key={i} className="rounded bg-surface-50 border border-surface-100 px-1.5 py-px font-mono-tight text-[9px] text-ink-600">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      {shown.length === 0 && (
        <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-ink-400">
          <Info className="h-5 w-5" />
          <p className="text-xs">No events yet — agent actions will appear here.</p>
        </div>
      )}
    </div>
  )
}
