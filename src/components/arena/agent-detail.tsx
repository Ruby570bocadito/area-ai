'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trophy, Swords, GraduationCap, Quote, History, Bug, ShieldCheck, Loader2, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import { RED_AGENTS, BLUE_AGENTS } from '@/lib/sim/roster'
import type { AgentDTO, EventDTO } from '@/lib/api-types'

const XP_PER_LEVEL = 80

const AGENT_PHASES = new Map<string, string[]>(
  [...RED_AGENTS, ...BLUE_AGENTS].map((a) => [a.key, a.phases])
)

const PHASE_SHORT: Record<string, string> = {
  RECON: 'Recon',
  ARMADO: 'Armado',
  INTRUSION: 'Intrusión',
  ESCALADA: 'Escalada',
  LATERAL: 'Lateral',
  OBJETIVO: 'Objetivo',
}

interface ActivityData {
  ok: boolean
  summary?: {
    totalActions: number
    successRate: number
    techniques: { name: string; count: number }[]
    targets: { name: string; count: number }[]
    byPhase: { phase: string; total: number; success: number }[]
  }
  events?: (EventDTO & { campaignCodename: string })[]
}

// ─────────────────────────────────────────────────────────────
// Ficha de agente — stats + fases asignadas en el motor +
// actividad REAL agregada desde la base de datos.
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
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [fetchedKey, setFetchedKey] = useState<string | null>(null)

  // Carga la actividad real (una vez por agente) al abrir la ficha
  useEffect(() => {
    if (!open || !agent || fetchedKey === agent.key) return
    let cancelled = false
    const key = agent.key
    fetch(`/api/agents/${key}/activity`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: ActivityData) => {
        if (cancelled) return
        setActivity(d)
        setFetchedKey(key)
      })
      .catch(() => {
        if (!cancelled) {
          setActivity({ ok: false })
          setFetchedKey(key)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, agent, fetchedKey])

  if (!agent) return null
  const loading = fetchedKey !== agent.key
  const activityForAgent = fetchedKey === agent.key ? activity : null
  const isRed = agent.team === 'RED'
  const accent = isRed ? '#d92d20' : '#0086c9'
  const soft = isRed ? '#b42318' : '#026aa2'
  const winRate = agent.campaigns > 0 ? Math.round((agent.victories / agent.campaigns) * 100) : 0
  const xpIntoLevel = agent.xp % XP_PER_LEVEL
  const xpPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)
  const phases = AGENT_PHASES.get(agent.key) ?? []
  const sum = activityForAgent?.summary ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="nice-scroll max-h-[85vh] max-w-md gap-0 overflow-y-auto border-[#e4e7ec] bg-white p-0 shadow-xl">
        {/* Cabecera con aura de equipo */}
        <div className="relative overflow-hidden p-6 pb-5">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.08] blur-3xl"
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
                  <h3 className={cn('font-display truncate text-lg font-extrabold tracking-tight', isRed ? 'text-[#b42318]' : 'text-[#026aa2]')}>
                    {agent.codename}
                  </h3>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 font-mono-tight text-[9px] font-bold tracking-wider',
                      isRed ? 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]' : 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]'
                    )}
                  >
                    {agent.team}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] font-medium text-[#344054]">{agent.role}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[11.5px] italic text-[#98a2b3]">
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
            { icon: Swords, label: 'Campañas', value: agent.campaigns, color: 'text-[#101828]' },
            { icon: Trophy, label: 'Victorias', value: agent.victories, color: 'text-[#067647]' },
            { icon: GraduationCap, label: 'Nivel', value: agent.level, color: 'text-[#b54708]' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
              className="rounded-xl border border-[#f2f4f7] bg-[#f9fafb] p-3 text-center"
            >
              <s.icon className={cn('mx-auto h-3.5 w-3.5', s.color)} />
              <p className={cn('font-display mt-1 text-lg font-extrabold', s.color)}>{s.value}</p>
              <p className="font-mono-tight text-[8.5px] uppercase tracking-[0.18em] text-[#98a2b3]">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* XP + winrate */}
        <div className="space-y-3 px-6 pt-4">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono-tight text-[10px] text-[#667085]">
              <span>Progreso a nivel {agent.level + 1}</span>
              <span>
                {xpIntoLevel}/{XP_PER_LEVEL} XP
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#f2f4f7]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${accent}99, ${accent})` }}
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono-tight text-[10px] text-[#667085]">
              <span>Tasa de victorias</span>
              <span>{winRate}%</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-[#f2f4f7]">
              <motion.div
                className="h-full bg-[#12b76a]"
                initial={{ width: 0 }}
                animate={{ width: `${winRate}%` }}
                transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Fases donde el motor le da la iniciativa */}
        {phases.length > 0 && (
          <div className="px-6 pt-4">
            <p className="font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#98a2b3]">
              Fases con iniciativa en el motor
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {phases.map((p) => (
                <span
                  key={p}
                  className="rounded-md border px-2 py-0.5 font-mono-tight text-[9.5px] font-bold"
                  style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0f`, color: soft }}
                >
                  {PHASE_SHORT[p] ?? p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actividad real desde la BD */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#98a2b3]">
              <History className="h-3 w-3" /> Actividad registrada
            </p>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-[#98a2b3]" />}
          </div>

          {sum && sum.totalActions > 0 ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] p-2.5 text-center">
                  <p className="font-display text-base font-extrabold text-[#101828]">{sum.totalActions}</p>
                  <p className="font-mono-tight text-[8.5px] uppercase tracking-[0.16em] text-[#98a2b3]">Acciones totales</p>
                </div>
                <div className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] p-2.5 text-center">
                  <p className="font-display text-base font-extrabold" style={{ color: sum.successRate >= 50 ? '#067647' : soft }}>
                    {sum.successRate}%
                  </p>
                  <p className="font-mono-tight text-[8.5px] uppercase tracking-[0.16em] text-[#98a2b3]">
                    {isRed ? 'Tasa de éxito' : 'Tasa de acierto'}
                  </p>
                </div>
              </div>

              {sum.techniques.length > 0 && (
                <div className="mt-2.5">
                  <p className="font-mono-tight text-[9px] uppercase tracking-[0.16em] text-[#98a2b3]">Técnicas más usadas</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {sum.techniques.slice(0, 4).map((t) => (
                      <span key={t.name} className="rounded bg-[#f2f4f7] px-1.5 py-0.5 text-[10px] text-[#344054]" title={`${t.count} usos`}>
                        {t.name} <span className="font-mono-tight text-[#667085]">×{t.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sum.byPhase.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  <p className="font-mono-tight text-[9px] uppercase tracking-[0.16em] text-[#98a2b3]">Rendimiento por fase</p>
                  {sum.byPhase.map((p) => (
                    <div key={p.phase} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 font-mono-tight text-[9.5px] text-[#667085]">{PHASE_SHORT[p.phase] ?? p.phase}</span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: accent }}
                          initial={{ width: 0 }}
                          animate={{ width: `${p.total > 0 ? (p.success / p.total) * 100 : 0}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <span className="shrink-0 font-mono-tight text-[9px] text-[#667085]">
                        {p.success}/{p.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* últimas acciones */}
              <div className="mt-3 space-y-1.5 border-t border-[#f2f4f7] pt-3">
                {activityForAgent?.events?.slice(0, 5).map((e, i) => {
                  const good = isRed ? e.result === 'EXITO' || e.result === 'PARCIAL' : e.result === 'BLOQUEADO' || e.result === 'DETECTADO' || e.result === 'CONTENIDO'
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }}
                      className="flex items-start gap-2"
                    >
                      <span
                        className={cn('mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm', good ? 'bg-[#ecfdf3] text-[#12b76a]' : 'bg-[#f2f4f7] text-[#98a2b3]')}
                      >
                        {isRed ? <Bug className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-[#101828]">
                          {e.action}
                          {e.targetNode && <span className="ml-1 font-mono-tight text-[9px] font-normal text-[#98a2b3]">{e.targetNode}</span>}
                        </p>
                        <p className="truncate font-mono-tight text-[9px] text-[#667085]">
                          {e.campaignCodename} · R{e.round} {e.phase}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </>
          ) : (
            !loading && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#f2f4f7] bg-[#f9fafb] p-2.5 text-[11px] text-[#667085]">
                <Activity className="h-3.5 w-3.5" />
                Sin acciones registradas todavía — entrará en combate en las campañas próximas.
              </p>
            )
          )}
        </div>

        {/* Descripción */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-4 border-t border-[#f2f4f7] px-6 py-4 text-[12px] leading-relaxed text-[#667085]"
        >
          {agent.description}
        </motion.p>
      </DialogContent>
    </Dialog>
  )
}
