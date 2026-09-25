'use client'

import Link from 'next/link'
import NumberFlow from '@number-flow/react'
import { motion } from 'framer-motion'
import {
  Swords,
  BrainCircuit,
  Trophy,
  GraduationCap,
  Radio,
  ArrowRight,
  Users,
  History,
  BarChart3,
  SlidersHorizontal,
  Crosshair,
  ShieldCheck,
  Minus,
  Infinity as InfinityIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { ControlCenter } from '@/components/arena/control-center'
import { EventFeed } from '@/components/arena/event-feed'

// ─────────────────────────────────────────────────────────────
// / — Panel de mando: visión general del laboratorio, KPIs,
// lanzamiento de campañas y accesos directos a cada módulo.
// ─────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: '/arena', label: 'Operaciones', desc: 'Mapa y telemetría en vivo', icon: Radio, tint: 'text-[#0086c9] bg-[#f0f9ff] border-[#bae6fd]' },
  { href: '/agentes', label: 'Agentes', desc: 'Roster y actividad real', icon: Users, tint: 'text-[#101828] bg-[#f2f4f7] border-[#e4e7ec]' },
  { href: '/conocimiento', label: 'Conocimiento', desc: 'Lecciones que evolucionan', icon: BrainCircuit, tint: 'text-[#7c3aed] bg-[#f5f3ff] border-[#ddd6fe]' },
  { href: '/historial', label: 'Historial', desc: 'Archivo de campañas', icon: History, tint: 'text-[#b54708] bg-[#fffaeb] border-[#fedf89]' },
  { href: '/analitica', label: 'Analítica', desc: 'Balance y evolución', icon: BarChart3, tint: 'text-[#067647] bg-[#ecfdf3] border-[#a6f4c5]' },
  { href: '/modelos', label: 'Modelos', desc: 'Motor LLM del sistema', icon: SlidersHorizontal, tint: 'text-[#101828] bg-[#f2f4f7] border-[#e4e7ec]' },
] as const

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  sub,
  delay = 0,
}: {
  icon: React.ElementType
  label: string
  value: number
  suffix?: string
  sub?: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="panel rounded-xl p-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">{label}</p>
        <Icon className="h-3.5 w-3.5 text-[#98a2b3]" />
      </div>
      <p className="font-display mt-2 text-[26px] font-extrabold leading-none tracking-tight text-[#101828]">
        <NumberFlow value={value} />
        {suffix && <span className="ml-1 text-[13px] font-semibold text-[#667085]">{suffix}</span>}
      </p>
      {sub && <div className="mt-1.5 text-[11px] leading-snug text-[#667085]">{sub}</div>}
    </motion.div>
  )
}

function DashboardPage() {
  const { state, running, handleStart, toggleAutopilot } = useArena()
  if (!state) return null

  const { stats, agents, liveCampaign } = state
  const avgLevel = agents.length > 0 ? (agents.reduce((acc, a) => acc + a.level, 0) / agents.length).toFixed(1) : '0'
  const totalWins = stats.redWins + stats.blueWins + stats.draws

  return (
    <PageContainer>
      <PageHeader
        kicker="Laboratorio adversarial"
        title="Panel de mando"
        subtitle="Elige un escenario, lanza una campaña autónoma Red vs Blue y observa cómo ambos equipos archivan conocimiento y evolucionan campaña tras campaña."
        actions={
          <span className="flex items-center gap-1.5 rounded-full border border-[#e4e7ec] bg-white px-3 py-1.5 font-mono-tight text-[10px] font-bold uppercase tracking-wider text-[#667085] shadow-sm">
            <InfinityIcon className={cn('h-3.5 w-3.5', state.autopilot ? 'text-[#7c3aed]' : 'text-[#98a2b3]')} />
            {state.autopilot ? 'Operación continua activa' : 'Motor listo'}
          </span>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={Swords}
          label="Campañas"
          value={stats.totalCampaigns}
          sub={running ? 'una en directo ahora mismo' : 'sin campañas activas'}
          delay={0}
        />
        <KpiCard
          icon={Trophy}
          label="Balance B·R·E"
          value={totalWins}
          sub={
            <span className="flex items-center gap-2 font-mono-tight text-[10px]">
              <span><b className="font-bold text-[#b42318]">{stats.redWins}</b> red</span>
              <span className="text-[#d0d5dd]">·</span>
              <span><b className="font-bold text-[#026aa2]">{stats.blueWins}</b> blue</span>
              <span className="text-[#d0d5dd]">·</span>
              <span><b className="font-bold text-[#b54708]">{stats.draws}</b> empates</span>
            </span>
          }
          delay={0.05}
        />
        <KpiCard
          icon={BrainCircuit}
          label="Lecciones"
          value={stats.knowledgeCount}
          sub={`evolución RED ${stats.evolutionRed}% · BLUE ${stats.evolutionBlue}%`}
          delay={0.1}
        />
        <KpiCard
          icon={GraduationCap}
          label="Nivel medio"
          value={Number(avgLevel)}
          suffix={`/ agentes: ${agents.length}`}
          sub="experiencia acumulada del roster"
          delay={0.15}
        />
      </div>

      {/* Lanzamiento + lateral */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <ControlCenter
          scenarios={state.scenarios}
          running={running}
          provider={state.provider}
          disabled={running}
          autopilot={state.autopilot}
          onToggleAutopilot={(v) => void toggleAutopilot(v)}
          onStart={(id) => void handleStart(id)}
        />

        <div className="space-y-4">
          {/* Campaña en curso / última campaña */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="panel rounded-xl p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">
                {running ? 'Campaña en curso' : liveCampaign ? 'Última campaña' : 'Arena'}
              </p>
              {running && <span className="status-live rounded-full border px-2 py-0.5 font-mono-tight text-[9px] font-bold">EN DIRECTO</span>}
            </div>
            {liveCampaign ? (
              <Link href="/arena" className="group mt-3 block">
                <p className="font-mono-tight text-[13px] font-bold tracking-wide text-[#101828] group-hover:text-[#026aa2]">
                  {liveCampaign.scenario.codename}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-[#667085]">
                  {liveCampaign.scenario.company} · {liveCampaign.scenario.industry}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-mono-tight text-[13px] font-extrabold text-[#b42318]">
                    <Crosshair className="h-3 w-3" /> {liveCampaign.redScore}
                  </span>
                  <span className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">
                    R{liveCampaign.round}/{liveCampaign.maxRounds}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono-tight text-[13px] font-extrabold text-[#026aa2]">
                    {liveCampaign.blueScore} <ShieldCheck className="h-3 w-3" />
                  </span>
                </div>
                <span className="mt-3 flex items-center gap-1 text-[11.5px] font-semibold text-[#026aa2]">
                  Abrir operaciones <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-[12px] leading-relaxed text-[#667085]">
                No hay ninguna campaña todavía. Lanza la primera desde el centro de mando o activa
                la operación continua para que el motor encadene campañas solo.
              </p>
            )}
          </motion.div>

          {/* Accesos rápidos */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="grid grid-cols-2 gap-2.5"
          >
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="panel panel-hover group rounded-xl p-3"
              >
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', l.tint)}>
                  <l.icon className="h-3.5 w-3.5" />
                </span>
                <p className="mt-2 text-[12.5px] font-semibold text-[#101828]">{l.label}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-[#667085]">{l.desc}</p>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Actividad reciente de la última campaña */}
      {liveCampaign && state.liveEvents.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-4"
          aria-label="Actividad reciente"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#667085]">
              <History className="h-3.5 w-3.5" /> Actividad reciente
            </h2>
            <Link href="/arena" className="flex items-center gap-1 text-[11.5px] font-semibold text-[#026aa2] hover:underline">
              Ver todo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <EventFeed events={state.liveEvents} max={6} className="max-h-[300px]" />
        </motion.section>
      )}
    </PageContainer>
  )
}

export default function Home() {
  return (
    <ArenaGate>
      <DashboardPage />
    </ArenaGate>
  )
}
