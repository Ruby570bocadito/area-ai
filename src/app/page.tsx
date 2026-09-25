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
  Infinity as InfinityIcon,
  Server,
  Activity,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { ControlCenter } from '@/components/arena/control-center'
import { EventFeed } from '@/components/arena/event-feed'

// ─────────────────────────────────────────────────────────────
// / — Panel de mando: KPIs, estado del laboratorio REAL,
// lanzamiento de campañas, actividad entre campañas, top
// operadores y evolución del conocimiento.
// ─────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: '/arena', label: 'Operaciones', desc: 'Mapa y telemetría en vivo', icon: Radio, tint: 'text-[#0086c9] bg-[#f0f9ff] border-[#bae6fd]' },
  { href: '/agentes', label: 'Agentes', desc: 'Roster y actividad real', icon: Users, tint: 'text-[#101828] bg-[#f2f4f7] border-[#e4e7ec]' },
  { href: '/conocimiento', label: 'Conocimiento', desc: 'Lecciones que evolucionan', icon: BrainCircuit, tint: 'text-[#7c3aed] bg-[#f5f3ff] border-[#ddd6fe]' },
  { href: '/historial', label: 'Historial', desc: 'Archivo de campañas', icon: History, tint: 'text-[#b54708] bg-[#fffaeb] border-[#fedf89]' },
  { href: '/analitica', label: 'Analítica', desc: 'Balance y evolución', icon: BarChart3, tint: 'text-[#067647] bg-[#ecfdf3] border-[#a6f4c5]' },
  { href: '/modelos', label: 'Modelos', desc: 'Motor LLM del sistema', icon: SlidersHorizontal, tint: 'text-[#101828] bg-[#f2f4f7] border-[#e4e7ec]' },
] as const

const RESULT_CHIP: Record<string, string> = {
  EXITO: 'bg-[#fef3f2] text-[#b42318] border-[#fecdca]',
  PARCIAL: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]',
  FALLO: 'bg-[#f9fafb] text-[#667085] border-[#e4e7ec]',
  BLOQUEADO: 'bg-[#f0f9ff] text-[#026aa2] border-[#b2ddff]',
  DETECTADO: 'bg-[#ecfdf3] text-[#067647] border-[#a6f4c5]',
  CONTENIDO: 'bg-[#f5f3ff] text-[#6941c6] border-[#ddd6fe]',
  ENDURECIDO: 'bg-[#f0f9ff] text-[#026aa2] border-[#b2ddff]',
  IGNORADO: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]',
}

function relTime(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `hace ${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

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

/** Estado del ciber range real: servicios HTTP, sesiones y reglas */
function LabStatusCard({ delay }: { delay: number }) {
  const { state, running } = useArena()
  if (!state) return null
  const lab = state.lab
  const liveLab = state.liveLab
  const activeMonitors = liveLab?.monitors?.length ?? 0

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }} className="panel rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">
          <Server className="h-3 w-3" /> Laboratorio real
        </p>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            lab.online ? 'bg-[#ecfdf3] text-[#067647]' : 'bg-[#f2f4f7] text-[#667085]'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', lab.online ? 'bg-[#12b76a] pulse-dot' : 'bg-[#98a2b3]')} />
          {lab.online ? 'operativo' : 'en espera'}
        </span>
      </div>
      {lab.online || liveLab ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">Servicios HTTP</p>
            <p className="font-mono-tight text-[13px] font-bold text-[#101828]">
              127.0.0.1:{lab.port ?? '—'}
            </p>
          </div>
          <div className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">Intercambios reales</p>
            <p className="font-mono-tight text-[13px] font-bold text-[#101828]">
              <NumberFlow value={lab.exchanges} />
            </p>
          </div>
          <div className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">Sesiones activas</p>
            <p className="font-mono-tight text-[13px] font-bold text-[#101828]">
              <NumberFlow value={liveLab?.sessions ?? 0} />
            </p>
          </div>
          <div className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">Reglas SIEM</p>
            <p className="font-mono-tight text-[13px] font-bold text-[#101828]">
              <NumberFlow value={activeMonitors} />
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] leading-relaxed text-[#667085]">
          Al iniciar una campaña se despliega un ciber range con servicios HTTP reales por nodo, política de red por
          segmentos y SIEM. Cada acción de los agentes es un intercambio verificable.
        </p>
      )}
      <p className="mt-2.5 border-t border-[#f2f4f7] pt-2 text-[10px] leading-snug text-[#98a2b3]">
        {running && liveLab
          ? `${liveLab.exchanges} intercambios HTTP en la campaña en curso · ${liveLab.nodes.filter((n) => n.compromised).length} nodos comprometidos · ${liveLab.nodes.filter((n) => n.isolated).length} aislados`
          : 'Los resultados se derivan de respuestas reales, no de dados.'}
      </p>
    </motion.div>
  )
}

/** Actividad reciente entre campañas (eventos reales de la BD) */
function RecentActivity() {
  const { state } = useArena()
  if (!state || state.recentActivity.length === 0) return null
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="panel rounded-xl p-4"
      aria-label="Actividad del laboratorio entre campañas"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">
          <Activity className="h-3 w-3" /> Actividad del laboratorio
        </p>
        <span className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">últimos eventos reales</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {state.recentActivity.slice(0, 8).map((e) => (
          <li key={e.id} className="flex items-center gap-2.5 rounded-lg border border-[#f2f4f7] bg-[#f9fafb] px-2.5 py-1.5">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', e.team === 'RED' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')} />
            <span className="font-mono-tight text-[10.5px] font-bold tracking-wide text-[#101828]">{e.agentCodename}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[#475467]">{e.action}</span>
            {e.result && (
              <span className={cn('shrink-0 rounded border px-1.5 py-px font-mono-tight text-[9px] font-bold', RESULT_CHIP[e.result] ?? 'border-[#e4e7ec] bg-white text-[#667085]')}>
                {e.result}
              </span>
            )}
            <span className="hidden shrink-0 rounded bg-white border border-[#f2f4f7] px-1.5 py-px font-mono-tight text-[9px] text-[#98a2b3] sm:block">
              {e.campaignCodename}
            </span>
            <span className="shrink-0 font-mono-tight text-[9px] text-[#98a2b3]">{relTime(e.createdAt)}</span>
          </li>
        ))}
      </ul>
    </motion.section>
  )
}

/** Top operadores por XP + evolución diaria del conocimiento */
function TopOperatorsAndSpark() {
  const { state } = useArena()
  if (!state) return null
  const max = Math.max(1, ...state.agents.map((a) => a.xp))
  const top = [...state.agents].sort((a, b) => b.xp - a.xp).slice(0, 5)
  const spark = state.knowledgeSpark ?? []
  const sparkMax = Math.max(1, ...spark)
  const sparkTotal = spark.reduce((s, v) => s + v, 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="grid gap-4 lg:grid-cols-2"
    >
      <div className="panel rounded-xl p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">
            <Flame className="h-3 w-3" /> Top operadores
          </p>
          <Link href="/agentes" className="flex items-center gap-1 text-[11px] font-semibold text-[#026aa2] hover:underline">
            Ver roster <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {top.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2.5">
              <span className="w-4 shrink-0 text-center font-mono-tight text-[10px] font-bold text-[#98a2b3]">{i + 1}</span>
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', a.team === 'RED' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')} />
              <span className="w-[74px] shrink-0 truncate font-mono-tight text-[10.5px] font-bold tracking-wide text-[#101828]">{a.codename}</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((a.xp / max) * 100)}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 + i * 0.05 }}
                  className={cn('h-full rounded-full', a.team === 'RED' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')}
                />
              </div>
              <span className="shrink-0 font-mono-tight text-[10px] text-[#667085]">
                Nv{a.level} · {a.xp} XP
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel rounded-xl p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">
            <BrainCircuit className="h-3 w-3" /> Conocimiento por día
          </p>
          <span className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">14 días · {sparkTotal} lecciones</span>
        </div>
        <div className="mt-3 flex h-[74px] items-end gap-[5px]">
          {spark.map((v, i) => (
            <motion.div
              key={i}
              initial={{ height: 2 }}
              animate={{ height: Math.max(3, Math.round((v / sparkMax) * 70)) }}
              transition={{ duration: 0.5, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              className={cn('flex-1 rounded-t-[3px]', v > 0 ? 'bg-gradient-to-t from-[#0086c9]/60 to-[#0086c9]' : 'bg-[#f2f4f7]')}
              title={`${v} lecciones`}
            />
          ))}
        </div>
        <p className="mt-2 border-t border-[#f2f4f7] pt-2 text-[10px] leading-snug text-[#98a2b3]">
          Cada lección nace de una campaña real y se reutiliza en las siguientes con su tasa de éxito.
        </p>
      </div>
    </motion.section>
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
        subtitle="Ciber range real: los agentes ejecutan comandos verificables contra servicios desplegados, archivan conocimiento y evolucionan campaña tras campaña."
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
          <LabStatusCard delay={0.18} />

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

      {/* Actividad en vivo de la campaña (si la hay) */}
      {liveCampaign && state.liveEvents.length > 0 && running && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4 }}
          className="mt-4"
          aria-label="Actividad reciente"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#667085]">
              <History className="h-3.5 w-3.5" /> Telemetría de la campaña en curso
            </h2>
            <Link href="/arena" className="flex items-center gap-1 text-[11.5px] font-semibold text-[#026aa2] hover:underline">
              Ver operaciones <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <EventFeed events={state.liveEvents} max={6} className="max-h-[300px]" />
        </motion.section>
      )}

      <div className="mt-4 space-y-4">
        <RecentActivity />
        <TopOperatorsAndSpark />
      </div>
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
