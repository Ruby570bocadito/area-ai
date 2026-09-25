'use client'

import { motion } from 'framer-motion'
import NumberFlow from '@number-flow/react'
import { Building2, Crown, Download, Swords, ShieldCheck, Trophy } from 'lucide-react'
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
  color: 'red' | 'blue'
  label: string
  icon: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className={cn('flex items-center gap-1.5 font-medium', color === 'red' ? 'text-[#f98ca0]' : 'text-[#8adcf7]')}>
          {icon}
          {label}
        </span>
        <span className={cn('font-mono-tight font-bold', color === 'red' ? 'text-[#f98ca0]' : 'text-[#8adcf7]')}>
          {value}/100
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className={cn('h-full rounded-full', color === 'red' ? 'bg-[#f4536e]' : 'bg-[#41c0ef]')}
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

  // Exporta el informe de campaña como Markdown descargable
  const downloadReport = () => {
    const res = winner === 'RED' ? 'VICTORIA RED' : winner === 'BLUE' ? 'VICTORIA BLUE' : winner == null && !running ? 'EMPATE' : 'EN CURSO'
    const lines = [
      `# Informe de campaña — ${campaign.scenario.codename}`,
      '',
      `- **Empresa:** ${campaign.scenario.company} (${campaign.scenario.industry})`,
      `- **Dificultad:** ${campaign.scenario.difficulty}/5`,
      `- **Estado:** ${res} · Ronda ${campaign.round}/${campaign.maxRounds}`,
      `- **Inicio:** ${new Date(campaign.startedAt).toLocaleString('es-ES')}`,
      campaign.endedAt ? `- **Fin:** ${new Date(campaign.endedAt).toLocaleString('es-ES')}` : null,
      '',
      `## Resultado`,
      `| Métrica | RED | BLUE |`,
      `| --- | --- | --- |`,
      `| Progreso objetivo | ${campaign.redProgress}/100 | ${campaign.blueProgress}/100 |`,
      `| Puntuación | ${campaign.redScore} | ${campaign.blueScore} |`,
      '',
      `## Objetivos`,
      `- **RED:** ${campaign.scenario.redObjective}`,
      `- **BLUE:** ${campaign.scenario.blueObjective}`,
      '',
      `## Registro de acciones (${events.length} eventos)`,
      ...events.map(
        (e) =>
          `### R${e.round} · [${e.team}] ${e.agentCodename ?? 'SISTEMA'} — ${e.action}\n\n${e.detail}${e.result ? `\n\n> Resultado: ${e.result} (impacto ${e.impact > 0 ? '+' : ''}${e.impact})` : ''}`
      ),
      '',
      `---`,
      `Generado por area·ai — laboratorio adversarial de agentes IA.`,
    ].filter((l): l is string => l != null)
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe-${campaign.scenario.key}-${campaign.id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Cabecera de campaña */}
      <div className="panel-raised relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Swords className={cn('h-4 w-4', running ? 'text-[#e8b64c] anim-blink' : 'text-muted-foreground')} />
              <h3 className="font-mono-tight text-base font-bold tracking-[0.12em] text-foreground sm:text-lg">
                {campaign.scenario.codename}
              </h3>
              {running ? (
                <span className="flex items-center gap-1.5 rounded-full border border-[#e8b64c]/45 bg-[#e8b64c]/[0.08] px-2.5 py-0.5 font-mono-tight text-[10px] font-bold text-[#f0cd85]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#e8b64c] anim-blink" /> EN VIVO
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-mono-tight text-[10px] font-bold text-muted-foreground">
                  FINALIZADA
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {campaign.scenario.company} · {campaign.scenario.industry} · dificultad {campaign.scenario.difficulty}/5
            </p>
          </div>
          {/* acciones + progreso de rondas */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={downloadReport}
              className="nav-link flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono-tight text-[10px] font-bold text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
              title="Descargar informe de la campaña en Markdown"
            >
              <Download className="h-3 w-3" /> Informe
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: campaign.maxRounds }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={false}
                  animate={{
                    backgroundColor: i < campaign.round ? (i % 2 === 0 ? '#f4536e' : '#41c0ef') : 'rgba(255,255,255,0.08)',
                    scale: running && i === campaign.round - 1 ? 1.25 : 1,
                  }}
                  className="h-2 w-4 rounded-sm"
                  title={`Ronda ${i + 1}`}
                />
              ))}
              <span className="ml-2 font-mono-tight text-[11px] text-muted-foreground">
                Ronda {campaign.round}/{campaign.maxRounds}
              </span>
            </div>
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
                  ? 'border-[#e8b64c]/50 bg-[#e8b64c]/[0.08] text-[#f0cd85]'
                  : i < phaseIdx || (i <= phaseIdx && !running)
                    ? 'border-white/15 bg-white/[0.04] text-foreground/70'
                    : 'border-white/[0.06] bg-transparent text-muted-foreground/50'
              )}
            >
              {p}
            </span>
          ))}
        </div>

        {/* Ticker de eventos en vivo */}
        {running && events.length > 0 && (
          <div className="marquee-mask relative z-10 mt-3 overflow-hidden border-t border-white/[0.05] pt-2.5" aria-hidden>
            <div className="marquee-track">
              {[0, 1].map((copy) => (
                <span key={copy} className="flex items-center">
                  {events.slice(-8).map((ev) => (
                    <span
                      key={`${copy}-${ev.id}`}
                      className="mx-4 flex items-center gap-2 font-mono-tight text-[10px] text-muted-foreground"
                    >
                      <span
                        className={cn(
                          'font-bold',
                          ev.team === 'RED' ? 'text-[#f98ca0]' : ev.team === 'BLUE' ? 'text-[#8adcf7]' : 'text-[#f0cd85]'
                        )}
                      >
                        {ev.agentCodename ?? 'SISTEMA'}
                      </span>
                      <span className="text-foreground/60">{ev.action}</span>
                      <span className="text-white/20">◆</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zona de batalla VS */}
      <div className="grid gap-4 lg:grid-cols-[230px_1fr_230px]">
        {/* Equipo RED */}
        <div className="space-y-2.5">
          <h4 className="font-mono-tight text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#f98ca0]">
            Red Team
          </h4>
          {redAgents.map((a) => (
            <AgentCard key={a.key} agent={a} active={a.key === activeRedKey} lastAction={a.key === activeRedKey ? lastRed?.action : null} />
          ))}
        </div>

        {/* Marcador central */}
        <div className="panel-raised relative flex flex-col justify-center gap-5 overflow-hidden rounded-2xl p-4 sm:p-5">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative z-10 flex items-center justify-center gap-6">
            <div className="text-right">
              <div className="relative">
                <motion.span
                  key={`rs-${campaign.redScore}`}
                  className="absolute -inset-x-3 -inset-y-1 rounded-xl bg-[#f4536e]/25 blur-md"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  aria-hidden
                />
                <p className="font-display relative text-4xl font-extrabold tracking-tight text-[#f4536e] sm:text-5xl">
                  <NumberFlow value={campaign.redScore} />
                </p>
              </div>
              <p className="mt-1 font-mono-tight text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">Impacto rojo</p>
            </div>
            <motion.div
              animate={running ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="font-display flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-base font-extrabold text-foreground/85"
            >
              VS
            </motion.div>
            <div className="text-left">
              <div className="relative">
                <motion.span
                  key={`bs-${campaign.blueScore}`}
                  className="absolute -inset-x-3 -inset-y-1 rounded-xl bg-[#41c0ef]/25 blur-md"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  aria-hidden
                />
                <p className="font-display relative text-4xl font-extrabold tracking-tight text-[#41c0ef] sm:text-5xl">
                  <NumberFlow value={campaign.blueScore} />
                </p>
              </div>
              <p className="mt-1 font-mono-tight text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">Defensa azul</p>
            </div>
          </div>
          <div className="relative z-10 space-y-3.5">
            <ProgressBar
              value={campaign.redProgress}
              color="red"
              label="Avance del objetivo ofensivo"
              icon={<Swords className="h-3 w-3" />}
            />
            <ProgressBar
              value={campaign.blueProgress}
              color="blue"
              label="Endurecimiento de la postura"
              icon={<ShieldCheck className="h-3 w-3" />}
            />
          </div>
          <div className="relative z-10 grid gap-2 text-[11px] sm:grid-cols-2">
            <p className="rounded-lg border border-[#f4536e]/20 bg-[#f4536e]/[0.05] p-2.5 leading-snug text-foreground/80">
              <span className="font-bold text-[#f98ca0]">Objetivo RED:</span> {campaign.scenario.redObjective}
            </p>
            <p className="rounded-lg border border-[#41c0ef]/20 bg-[#41c0ef]/[0.05] p-2.5 leading-snug text-foreground/80">
              <span className="font-bold text-[#8adcf7]">Objetivo BLUE:</span> {campaign.scenario.blueObjective}
            </p>
          </div>
        </div>

        {/* Equipo BLUE */}
        <div className="space-y-2.5">
          <h4 className="font-mono-tight text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#8adcf7]">
            Blue Team
          </h4>
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
          <div className="panel rounded-xl p-6 text-sm text-muted-foreground">Sin mapa disponible.</div>
        )}
        <EventFeed events={events} className="max-h-[420px] min-h-[280px]" />
      </div>

      {/* Resolución */}
      {campaign.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'panel-raised winner-shine relative overflow-hidden rounded-2xl p-5',
            winner === 'RED' ? 'active-red' : winner === 'BLUE' ? 'active-blue' : 'active-amber'
          )}
        >
          <div className="flex flex-wrap items-center gap-3.5">
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.15 }}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl border',
                winner === 'RED'
                  ? 'border-[#f4536e]/45 bg-[#f4536e]/[0.08] text-[#f98ca0]'
                  : winner === 'BLUE'
                    ? 'border-[#41c0ef]/45 bg-[#41c0ef]/[0.08] text-[#8adcf7]'
                    : 'border-[#e8b64c]/45 bg-[#e8b64c]/[0.08] text-[#f0cd85]'
              )}
            >
              {winner === 'DRAW' ? (
                <Crown className="h-5 w-5" />
              ) : (
                <motion.span
                  animate={{ y: [0, -2.5, 0], rotate: [0, 4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex"
                >
                  <Trophy className="h-5 w-5" />
                </motion.span>
              )}
            </motion.span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-mono-tight text-sm font-black uppercase tracking-[0.15em]',
                  winner === 'RED' ? 'text-[#f98ca0]' : winner === 'BLUE' ? 'text-[#8adcf7]' : 'text-[#f0cd85]'
                )}
              >
                {winner === 'RED'
                  ? 'Victoria del RED TEAM'
                  : winner === 'BLUE'
                    ? 'Victoria del BLUE TEAM'
                    : 'Empate táctico'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{campaign.narrative}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
