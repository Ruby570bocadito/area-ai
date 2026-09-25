'use client'

import { motion } from 'framer-motion'
import NumberFlow from '@number-flow/react'
import { Building2, Crown, Download, Info, Swords, ShieldCheck, Trophy, Target, TerminalSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/text'
import { explainWinner, VICTORY_RULE_DETAIL } from '@/lib/victory'
import type { AgentDTO, CampaignSummaryDTO, EventDTO, InfraNodeDTO, LiveLabDTO } from '@/lib/api-types'
import { AgentCard } from './agent-avatar'
import { EventFeed } from './event-feed'
import { NetworkMap } from './network-map'

const PHASES = ['RECON', 'ARMADO', 'INTRUSION', 'ESCALADA', 'LATERAL', 'OBJETIVO'] as const

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  EXITO: { label: 'ÉXITO', cls: 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]' },
  PARCIAL: { label: 'PARCIAL', cls: 'border-[#fedf89] bg-[#fffaeb] text-[#b54708]' },
  FALLO: { label: 'FALLO', cls: 'border-surface-200 bg-surface-50 text-ink-500' },
  BLOQUEADO: { label: 'BLOQUEADO', cls: 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]' },
  DETECTADO: { label: 'DETECTADO', cls: 'border-[#a6f4c5] bg-[#ecfdf3] text-[#067647]' },
  CONTENIDO: { label: 'CONTENIDO', cls: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6941c6]' },
  ENDURECIDO: { label: 'ENDURECIDO', cls: 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]' },
  IGNORADO: { label: 'IGNORADO', cls: 'border-[#fedf89] bg-[#fffaeb] text-[#b54708]' },
}

// Tarjeta del operador que está resolviendo el turno ahora mismo.
function TurnOperator({
  team,
  agent,
  event,
}: {
  team: 'red' | 'blue'
  agent?: { codename: string; role: string; level: number }
  event?: { action: string; detail: string; result: string | null; targetNode: string | null; impact: number; command?: string | null; evidence?: string | null }
}) {
  const accent = team === 'red' ? '#d92d20' : '#0086c9'
  const deep = team === 'red' ? '#b42318' : '#026aa2'
  const badge = event?.result ? RESULT_BADGE[event.result] : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="panel relative overflow-hidden rounded-xl p-3.5"
      style={{ borderColor: `${accent}55` }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {agent ? (
            <>
              <span className="font-mono-tight truncate text-[11.5px] font-bold tracking-wide" style={{ color: deep }}>
                {agent.codename}
              </span>
              <span className="hidden truncate text-[10.5px] text-ink-500 sm:inline">{agent.role}</span>
            </>
          ) : (
            <span className="font-mono-tight text-[11px] text-ink-400">
              {team === 'red' ? 'RED sin acciones aún' : 'BLUE sin acciones aún'}
            </span>
          )}
        </div>
        {badge && (
          <span className={cn('shrink-0 rounded border px-1.5 py-px font-mono-tight text-[9px] font-bold', badge.cls)}>
            {badge.label}
            {event && event.impact > 0 && ` +${event.impact}`}
          </span>
        )}
      </div>
      {event && (
        <>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold leading-snug text-ink-900">
            <Target className="h-3 w-3 shrink-0" style={{ color: accent }} />
            {event.action}
            {event.targetNode && (
              <span className="ml-1 rounded bg-surface-100 px-1.5 py-px font-mono-tight text-[9px] font-normal text-ink-500">
                {event.targetNode}
              </span>
            )}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500">{event.detail}</p>
          {event.command && (
            <p className="mt-1.5 truncate rounded-md border border-surface-200 bg-surface-50 px-2 py-1 font-mono-tight text-[9.5px] text-ink-600" title={event.command}>
              <TerminalSquare className="mr-1 inline h-3 w-3 text-ink-400" />
              {event.command}
            </p>
          )}
        </>
      )}
    </motion.div>
  )
}

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
        <span className={cn('flex items-center gap-1.5 font-medium', color === 'red' ? 'text-[#b42318]' : 'text-[#026aa2]')}>
          {icon}
          {label}
        </span>
        <span className={cn('font-mono-tight font-bold', color === 'red' ? 'text-[#b42318]' : 'text-[#026aa2]')}>
          {value}/100
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-100">
        <motion.div
          className={cn('h-full rounded-full', color === 'red' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')}
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
  liveLab,
}: {
  campaign: CampaignSummaryDTO
  events: EventDTO[]
  agents: AgentDTO[]
  infraNodes: InfraNodeDTO[]
  running: boolean
  liveLab?: LiveLabDTO | null
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
      `- **Inicio:** ${formatDateTime(campaign.startedAt)}`,
      campaign.endedAt ? `- **Fin:** ${formatDateTime(campaign.endedAt)}` : null,
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
              <Swords className={cn('h-4 w-4', running ? 'text-[#b54708] pulse-dot' : 'text-ink-400')} />
              <h3 className="font-mono-tight text-base font-bold tracking-[0.12em] text-ink-900 sm:text-lg">
                {campaign.scenario.codename}
              </h3>
              {running ? (
                <span className="flex items-center gap-1.5 rounded-full border border-[#fec84b] bg-[#fffaeb] px-2.5 py-0.5 font-mono-tight text-[10px] font-bold text-[#b54708]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d97706] pulse-dot" /> EN VIVO
                </span>
              ) : (
                <span className="rounded-full border border-surface-200 bg-surface-50 px-2.5 py-0.5 font-mono-tight text-[10px] font-bold text-ink-500">
                  FINALIZADA
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
              <Building2 className="h-3 w-3" />
              {campaign.scenario.company} · {campaign.scenario.industry} · dificultad {campaign.scenario.difficulty}/5
            </p>
          </div>
          {/* acciones + progreso de rondas */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={downloadReport}
              className="flex items-center gap-1.5 rounded-md border border-surface-200 bg-white px-2.5 py-1 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-surface-300 hover:text-ink-900"
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
                    backgroundColor: i < campaign.round ? (i % 2 === 0 ? '#d92d20' : '#0086c9') : '#eaecf0',
                    scale: running && i === campaign.round - 1 ? 1.25 : 1,
                  }}
                  className="h-2 w-4 rounded-sm"
                  title={`Ronda ${i + 1}`}
                />
              ))}
              <span className="ml-2 font-mono-tight text-[11px] text-ink-500">
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
                  ? 'border-[#fec84b] bg-[#fffaeb] text-[#b54708]'
                  : i < phaseIdx || (i <= phaseIdx && !running)
                    ? 'border-surface-300 bg-surface-100 text-ink-600'
                    : 'border-surface-100 bg-transparent text-ink-400'
              )}
            >
              {p}
            </span>
          ))}
        </div>

        {/* Ticker de eventos en vivo */}
        {running && events.length > 0 && (
          <div className="marquee-mask relative z-10 mt-3 overflow-hidden border-t border-surface-100 pt-2.5" aria-hidden>
            <div className="marquee-track">
              {[0, 1].map((copy) => (
                <span key={copy} className="flex items-center">
                  {events.slice(-8).map((ev) => (
                    <span
                      key={`${copy}-${ev.id}`}
                      className="mx-4 flex items-center gap-2 font-mono-tight text-[10px] text-ink-500"
                    >
                      <span
                        className={cn(
                          'font-bold',
                          ev.team === 'RED' ? 'text-[#b42318]' : ev.team === 'BLUE' ? 'text-[#026aa2]' : 'text-[#b54708]'
                        )}
                      >
                        {ev.agentCodename ?? 'SISTEMA'}
                      </span>
                      <span className="text-ink-600">{ev.action}</span>
                      <span className="text-surface-300">◆</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Operadores en turno — qué agente está haciendo qué ahora mismo */}
      {running && events.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TurnOperator
            team="red"
            agent={agents.find((a) => a.key === lastRed?.agentKey) ?? undefined}
            event={
              lastRed
                ? { action: lastRed.action, detail: lastRed.detail, result: lastRed.result, targetNode: lastRed.targetNode, impact: lastRed.impact, command: lastRed.command }
                : undefined
            }
          />
          <TurnOperator
            team="blue"
            agent={agents.find((a) => a.key === lastBlue?.agentKey) ?? undefined}
            event={
              lastBlue
                ? { action: lastBlue.action, detail: lastBlue.detail, result: lastBlue.result, targetNode: lastBlue.targetNode, impact: lastBlue.impact, command: lastBlue.command }
                : undefined
            }
          />
        </div>
      )}

      {/* Zona de batalla VS */}
      <div className="grid gap-4 lg:grid-cols-[230px_1fr_230px]">
        {/* Equipo RED */}
        <div className="space-y-2.5">
          <h4 className="font-mono-tight text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#b42318]">
            Red Team
          </h4>
          {redAgents.map((a) => (
            <AgentCard key={a.key} agent={a} active={a.key === activeRedKey} lastAction={a.key === activeRedKey ? lastRed?.action : null} />
          ))}
        </div>

        {/* Marcador central */}
        <div className="panel-raised relative flex flex-col justify-center gap-5 overflow-hidden rounded-2xl p-4 sm:p-5">
          <div className="grid-bg absolute inset-0 opacity-60" />
          <div className="relative z-10 flex items-center justify-center gap-6">
            <div className="text-right">
              <div className="relative">
                <motion.span
                  key={`rs-${campaign.redScore}`}
                  className="absolute -inset-x-3 -inset-y-1 rounded-xl bg-[#d92d20]/15 blur-md"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  aria-hidden
                />
                <p className="font-display relative text-4xl font-extrabold tracking-tight text-[#d92d20] sm:text-5xl">
                  <NumberFlow value={campaign.redScore} />
                </p>
              </div>
              <p className="mt-1 font-mono-tight text-[9.5px] uppercase tracking-[0.2em] text-ink-400">Impacto rojo</p>
            </div>
            <motion.div
              animate={running ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="font-display flex h-12 w-12 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-base font-extrabold text-ink-600"
            >
              VS
            </motion.div>
            <div className="text-left">
              <div className="relative">
                <motion.span
                  key={`bs-${campaign.blueScore}`}
                  className="absolute -inset-x-3 -inset-y-1 rounded-xl bg-[#0086c9]/15 blur-md"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  aria-hidden
                />
                <p className="font-display relative text-4xl font-extrabold tracking-tight text-[#0086c9] sm:text-5xl">
                  <NumberFlow value={campaign.blueScore} />
                </p>
              </div>
              <p className="mt-1 font-mono-tight text-[9.5px] uppercase tracking-[0.2em] text-ink-400">Defensa azul</p>
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
            <p className="rounded-lg border border-[#fecdca] bg-[#fef3f2] p-2.5 leading-snug text-ink-700">
              <span className="font-bold text-[#b42318]">Objetivo RED:</span> {campaign.scenario.redObjective}
            </p>
            <p className="rounded-lg border border-[#b2ddff] bg-[#f0f9ff] p-2.5 leading-snug text-ink-700">
              <span className="font-bold text-[#026aa2]">Objetivo BLUE:</span> {campaign.scenario.blueObjective}
            </p>
          </div>
        </div>

        {/* Equipo BLUE */}
        <div className="space-y-2.5">
          <h4 className="font-mono-tight text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#026aa2]">
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
          <NetworkMap nodes={infraNodes} events={events} running={running} phase={campaign.phase} liveLab={liveLab} />
        ) : (
          <div className="panel rounded-xl p-6 text-sm text-ink-500">Sin mapa disponible.</div>
        )}
        <EventFeed events={events} className="max-h-[420px] min-h-[280px]" />
      </div>

      {/* Resolución */}
      {campaign.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'panel-raised relative overflow-hidden rounded-2xl p-5',
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
                  ? 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]'
                  : winner === 'BLUE'
                    ? 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]'
                    : 'border-[#fedf89] bg-[#fffaeb] text-[#b54708]'
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
                  winner === 'RED' ? 'text-[#b42318]' : winner === 'BLUE' ? 'text-[#026aa2]' : 'text-[#b54708]'
                )}
              >
                {winner === 'RED'
                  ? 'Victoria del RED TEAM'
                  : winner === 'BLUE'
                    ? 'Victoria del BLUE TEAM'
                    : 'Empate táctico'}
              </p>
              <p className="mt-0.5 font-mono-tight text-[10.5px] text-ink-600">
                {explainWinner(winner, campaign.redProgress, campaign.blueProgress)}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{campaign.narrative}</p>
            </div>
            <span
              className="hidden cursor-help items-center gap-1.5 rounded-lg border border-surface-200 bg-white/70 px-2.5 py-1.5 font-mono-tight text-[9.5px] font-bold text-ink-500 sm:flex"
              title={VICTORY_RULE_DETAIL}
            >
              <Info className="h-3 w-3" /> regla: progreso, no puntos
            </span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
