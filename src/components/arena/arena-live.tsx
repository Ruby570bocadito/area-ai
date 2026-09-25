'use client'

import { motion } from 'framer-motion'
import { Building2, Crown, Swords, ShieldCheck, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentDTO, CampaignSummaryDTO, EventDTO, InfraNodeDTO } from '@/lib/api-types'
import { AgentCard } from './agent-avatar'
import { EventFeed } from './event-feed'
import { NetworkMap } from './network-map'

const PHASES = ['RECON', 'ARMADO', 'INTRUSION', 'ESCALADA', 'LATERAL', 'OBJETIVO'] as const

function ProgressBar({
  value,
  color,
  label,
  icon,
}: {
  value: number
  color: 'red' | 'cyan'
  label: string
  icon: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className={cn('flex items-center gap-1.5 font-semibold', color === 'red' ? 'text-[#ff8299]' : 'text-[#7ee7f9]')}>
          {icon}
          {label}
        </span>
        <span className={cn('font-mono-tight font-bold', color === 'red' ? 'text-[#ff8299]' : 'text-[#7ee7f9]')}>
          {value}/100
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/50">
        <motion.div
          className={cn(
            'h-full rounded-full',
            color === 'red'
              ? 'bg-gradient-to-r from-[#ff3355]/70 to-[#ff3355] shadow-[0_0_12px_rgba(255,51,85,0.6)]'
              : 'bg-gradient-to-r from-[#22d3ee]/70 to-[#22d3ee] shadow-[0_0_12px_rgba(34,211,238,0.6)]'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </div>
    </div>
  )
}

export function ArenaLive({
  campaign,
  events,
  agents,
  infraNodes,
  running,
}: {
  campaign: CampaignSummaryDTO
  events: EventDTO[]
  agents: AgentDTO[]
  infraNodes: InfraNodeDTO[]
  running: boolean
}) {
  const redAgents = agents.filter((a) => a.team === 'RED')
  const blueAgents = agents.filter((a) => a.team === 'BLUE')

  const redEvents = events.filter((e) => e.team === 'RED')
  const blueEvents = events.filter((e) => e.team === 'BLUE')
  const lastRed = redEvents[redEvents.length - 1]
  const lastBlue = blueEvents[blueEvents.length - 1]

  const activeRedKey = running && lastRed ? lastRed.agentKey : null
  const activeBlueKey = running && lastBlue ? lastBlue.agentKey : null

  const phaseIdx = PHASES.indexOf(campaign.phase as (typeof PHASES)[number])
  const winner = campaign.winner

  return (
    <div className="space-y-4">
      {/* Cabecera de campaña */}
      <div className="glass-strong relative overflow-hidden rounded-2xl p-4 sm:p-5">
        {running && <div className="scan-beam" />}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Swords className={cn('h-4 w-4', running ? 'text-amber-400 anim-blink' : 'text-muted-foreground')} />
              <h2 className="font-mono-tight text-base font-bold tracking-widest text-foreground sm:text-lg">
                {campaign.scenario.codename}
              </h2>
              {running ? (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 anim-blink" /> EN VIVO
                </span>
              ) : (
                <span className="rounded-full border border-[#1c2b4a] bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  FINALIZADA
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {campaign.scenario.company} · {campaign.scenario.industry} · dificultad {campaign.scenario.difficulty}/5
            </p>
          </div>
          {/* progreso de rondas por fase */}
          <div className="flex items-center gap-1">
            {Array.from({ length: campaign.maxRounds }).map((_, i) => (
              <motion.span
                key={i}
                initial={false}
                animate={{
                  backgroundColor: i < campaign.round ? (i % 2 === 0 ? '#ff3355' : '#22d3ee') : 'rgba(255,255,255,0.08)',
                  scale: running && i === campaign.round - 1 ? 1.25 : 1,
                }}
                className="h-2.5 w-4 rounded-sm"
                title={`Ronda ${i + 1}`}
              />
            ))}
            <span className="ml-2 font-mono-tight text-[11px] text-muted-foreground">
              Ronda {campaign.round}/{campaign.maxRounds}
            </span>
          </div>
        </div>
        {/* fases */}
        <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
          {PHASES.map((p, i) => (
            <span
              key={p}
              className={cn(
                'rounded-md border px-2 py-0.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-wider transition-colors',
                i === phaseIdx && running
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 anim-blink'
                  : i < phaseIdx || (i <= phaseIdx && !running)
                    ? 'border-[#22d3ee]/30 bg-[#22d3ee]/5 text-[#7ee7f9]/80'
                    : 'border-[#1c2b4a] bg-black/30 text-muted-foreground/60'
              )}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Zona de batalla VS */}
      <div className="grid gap-4 lg:grid-cols-[230px_1fr_230px]">
        {/* Equipo RED */}
        <div className="space-y-2.5">
          <h3 className="text-center font-mono-tight text-xs font-bold uppercase tracking-[0.25em] text-[#ff6b85] text-glow-red">
            Red Team
          </h3>
          {redAgents.map((a) => (
            <AgentCard key={a.key} agent={a} active={a.key === activeRedKey} lastAction={a.key === activeRedKey ? lastRed?.action : null} />
          ))}
        </div>

        {/* Marcador central */}
        <div className="glass-strong relative flex flex-col justify-center gap-4 overflow-hidden rounded-2xl p-4 sm:p-5">
          <div className="grid-bg absolute inset-0 opacity-60" />
          <div className="relative z-10 flex items-center justify-center gap-4">
            <div className="text-right">
              <p className="font-mono-tight text-3xl font-black text-[#ff5f7a] text-glow-red sm:text-4xl">
                {campaign.redScore}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impacto rojo</p>
            </div>
            <motion.div
              animate={running ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#a755ff]/60 bg-black/60 font-mono-tight text-lg font-black text-[#c4a5ff] shadow-[0_0_24px_rgba(167,85,255,0.4)]"
            >
              VS
            </motion.div>
            <div className="text-left">
              <p className="font-mono-tight text-3xl font-black text-[#67e8f9] text-glow-cyan sm:text-4xl">
                {campaign.blueScore}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Defensa azul</p>
            </div>
          </div>
          <div className="relative z-10 space-y-3">
            <ProgressBar
              value={campaign.redProgress}
              color="red"
              label="Avance del objetivo ofensivo"
              icon={<Swords className="h-3 w-3" />}
            />
            <ProgressBar
              value={campaign.blueProgress}
              color="cyan"
              label="Endurecimiento de la postura"
              icon={<ShieldCheck className="h-3 w-3" />}
            />
          </div>
          <div className="relative z-10 grid gap-2 text-[11px] sm:grid-cols-2">
            <p className="rounded-lg border border-[#ff3355]/20 bg-[#ff3355]/5 p-2 leading-snug text-foreground/80">
              <span className="font-bold text-[#ff8299]">Objetivo RED:</span> {campaign.scenario.redObjective}
            </p>
            <p className="rounded-lg border border-[#22d3ee]/20 bg-[#22d3ee]/5 p-2 leading-snug text-foreground/80">
              <span className="font-bold text-[#7ee7f9]">Objetivo BLUE:</span> {campaign.scenario.blueObjective}
            </p>
          </div>
        </div>

        {/* Equipo BLUE */}
        <div className="space-y-2.5">
          <h3 className="text-center font-mono-tight text-xs font-bold uppercase tracking-[0.25em] text-[#67e8f9] text-glow-cyan">
            Blue Team
          </h3>
          {blueAgents.map((a) => (
            <AgentCard key={a.key} agent={a} active={a.key === activeBlueKey} lastAction={a.key === activeBlueKey ? lastBlue?.action : null} />
          ))}
        </div>
      </div>

      {/* Mapa + Feed */}
      <div className="grid gap-4 xl:grid-cols-2">
        {infraNodes.length > 0 ? (
          <NetworkMap nodes={infraNodes} events={events} running={running} />
        ) : (
          <div className="glass rounded-xl p-6 text-sm text-muted-foreground">Sin mapa disponible.</div>
        )}
        <EventFeed events={events} className="max-h-[420px] min-h-[280px]" />
      </div>

      {/* Resolución */}
      {campaign.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'glass-strong relative overflow-hidden rounded-2xl border p-5',
            winner === 'RED' ? 'glow-red' : winner === 'BLUE' ? 'glow-cyan' : 'glow-amber'
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl border',
                winner === 'RED'
                  ? 'border-[#ff3355]/50 bg-[#ff3355]/10 text-[#ff5f7a]'
                  : winner === 'BLUE'
                    ? 'border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#67e8f9]'
                    : 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              )}
            >
              {winner === 'DRAW' ? <Crown className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-mono-tight text-sm font-black uppercase tracking-widest',
                  winner === 'RED' ? 'text-[#ff5f7a] text-glow-red' : winner === 'BLUE' ? 'text-[#67e8f9] text-glow-cyan' : 'text-amber-300'
                )}
              >
                {winner === 'RED'
                  ? 'Victoria del RED TEAM'
                  : winner === 'BLUE'
                    ? 'Victoria del BLUE TEAM'
                    : 'Empate táctico'}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{campaign.narrative}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
