'use client'

import Link from 'next/link'
import NumberFlow from '@number-flow/react'
import { motion, useReducedMotion } from 'framer-motion'
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
import { ArenaGate, PageContainer } from '@/components/arena/shell/page-frame'
import Particles from '@/components/arena/reactbits/particles/Particles'
import ShinyText from '@/components/arena/reactbits/shiny-text/ShinyText'
import GradientText from '@/components/arena/reactbits/gradient-text/GradientText'
import { ControlCenter } from '@/components/arena/control-center'
import { EventFeed } from '@/components/arena/event-feed'

// ─────────────────────────────────────────────────────────────
// / — Panel de mando: KPIs, estado del laboratorio REAL,
// lanzamiento de campañas, actividad entre campañas, top
// operadores y evolución del conocimiento.
// ─────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: '/arena', label: 'Operaciones', desc: 'Mapa y telemetría en vivo', icon: Radio, tint: 'text-[#0086c9] bg-[#f0f9ff] border-[#bae6fd]' },
  { href: '/agentes', label: 'Agentes', desc: 'Roster y actividad real', icon: Users, tint: 'text-ink-900 bg-surface-100 border-surface-200' },
  { href: '/conocimiento', label: 'Conocimiento', desc: 'Lecciones que evolucionan', icon: BrainCircuit, tint: 'text-[#7c3aed] bg-[#f5f3ff] border-[#ddd6fe]' },
  { href: '/historial', label: 'Historial', desc: 'Archivo de campañas', icon: History, tint: 'text-[#b54708] bg-[#fffaeb] border-[#fedf89]' },
  { href: '/analitica', label: 'Analítica', desc: 'Balance y evolución', icon: BarChart3, tint: 'text-[#067647] bg-[#ecfdf3] border-[#a6f4c5]' },
  { href: '/modelos', label: 'Modelos', desc: 'Motor LLM del sistema', icon: SlidersHorizontal, tint: 'text-ink-900 bg-surface-100 border-surface-200' },
] as const

const RESULT_CHIP: Record<string, string> = {
  EXITO: 'bg-[#fef3f2] text-[#b42318] border-[#fecdca]',
  PARCIAL: 'bg-[#fffaeb] text-[#b54708] border-[#fedf89]',
  FALLO: 'bg-surface-50 text-ink-500 border-surface-200',
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
        <p className="font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">{label}</p>
        <Icon className="h-3.5 w-3.5 text-ink-400" />
      </div>
      <p className="font-display mt-2 text-[26px] font-extrabold leading-none tracking-tight text-ink-900">
        <NumberFlow value={value} />
        {suffix && <span className="ml-1 text-[13px] font-semibold text-ink-500">{suffix}</span>}
      </p>
      {sub && <div className="mt-1.5 text-[11px] leading-snug text-ink-500">{sub}</div>}
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
        <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
          <Server className="h-3 w-3" /> Laboratorio real
        </p>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
            lab.online ? 'bg-[#ecfdf3] text-[#067647]' : 'bg-surface-100 text-ink-500'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', lab.online ? 'bg-[#12b76a] pulse-dot' : 'bg-ink-400')} />
          {lab.online ? 'operativo' : 'en espera'}
        </span>
      </div>
      {lab.online || liveLab ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Servicios HTTP</p>
            <p className="font-mono-tight text-[13px] font-bold text-ink-900">
              127.0.0.1:{lab.port ?? '—'}
            </p>
          </div>
          <div className="rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Intercambios reales</p>
            <p className="font-mono-tight text-[13px] font-bold text-ink-900">
              <NumberFlow value={lab.exchanges} />
            </p>
          </div>
          <div className="rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Sesiones activas</p>
            <p className="font-mono-tight text-[13px] font-bold text-ink-900">
              <NumberFlow value={liveLab?.sessions ?? 0} />
            </p>
          </div>
          <div className="rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-1.5">
            <p className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">Reglas SIEM</p>
            <p className="font-mono-tight text-[13px] font-bold text-ink-900">
              <NumberFlow value={activeMonitors} />
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500">
          Al iniciar una campaña se despliega un ciber range con servicios HTTP reales por nodo, política de red por
          segmentos y SIEM. Cada acción de los agentes es un intercambio verificable.
        </p>
      )}
      <p className="mt-2.5 border-t border-surface-100 pt-2 text-[10px] leading-snug text-ink-400">
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
        <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
          <Activity className="h-3 w-3" /> Actividad del laboratorio
        </p>
        <span className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">últimos eventos reales</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {state.recentActivity.slice(0, 8).map((e) => (
          <li key={e.id} className="flex items-center gap-2.5 rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-1.5">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', e.team === 'RED' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')} />
            <span className="font-mono-tight text-[10.5px] font-bold tracking-wide text-ink-900">{e.agentCodename}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-ink-600">{e.action}</span>
            {e.result && (
              <span className={cn('shrink-0 rounded border px-1.5 py-px font-mono-tight text-[9px] font-bold', RESULT_CHIP[e.result] ?? 'border-surface-200 bg-white text-ink-500')}>
                {e.result}
              </span>
            )}
            <span className="hidden shrink-0 rounded bg-white border border-surface-100 px-1.5 py-px font-mono-tight text-[9px] text-ink-400 sm:block">
              {e.campaignCodename}
            </span>
            <span className="shrink-0 font-mono-tight text-[9px] text-ink-400">{relTime(e.createdAt)}</span>
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
          <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
            <Flame className="h-3 w-3" /> Top operadores
          </p>
          <Link href="/agentes" className="flex items-center gap-1 text-[11px] font-semibold text-[#026aa2] hover:underline">
            Ver roster <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {top.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2.5">
              <span className="w-4 shrink-0 text-center font-mono-tight text-[10px] font-bold text-ink-400">{i + 1}</span>
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', a.team === 'RED' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')} />
              <span className="w-[74px] shrink-0 truncate font-mono-tight text-[10.5px] font-bold tracking-wide text-ink-900">{a.codename}</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((a.xp / max) * 100)}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 + i * 0.05 }}
                  className={cn('h-full rounded-full', a.team === 'RED' ? 'bg-[#d92d20]' : 'bg-[#0086c9]')}
                />
              </div>
              <span className="shrink-0 font-mono-tight text-[10px] text-ink-500">
                Nv{a.level} · {a.xp} XP
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel rounded-xl p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
            <BrainCircuit className="h-3 w-3" /> Conocimiento por día
          </p>
          <span className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">14 días · {sparkTotal} lecciones</span>
        </div>
        <div className="mt-3 flex h-[74px] items-end gap-[5px]">
          {spark.map((v, i) => (
            <motion.div
              key={i}
              initial={{ height: 2 }}
              animate={{ height: Math.max(3, Math.round((v / sparkMax) * 70)) }}
              transition={{ duration: 0.5, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              className={cn('flex-1 rounded-t-[3px]', v > 0 ? 'bg-gradient-to-t from-[#0086c9]/60 to-[#0086c9]' : 'bg-surface-100')}
              title={`${v} lecciones`}
            />
          ))}
        </div>
        <p className="mt-2 border-t border-surface-100 pt-2 text-[10px] leading-snug text-ink-400">
          Cada lección nace de una campaña real y se reutiliza en las siguientes con su tasa de éxito.
        </p>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────
// Héroe de la portada — banda oscura con campo de partículas
// RED/BLUE (React Bits Particles), kicker con brillo (ShinyText)
// y título con degradado animado (GradientText). El fondo animado
// se omite si el usuario prefiere movimiento reducido.
// ─────────────────────────────────────────────────────────────

function HeroBand({ autopilot }: { autopilot: boolean }) {
  const reducedMotion = useReducedMotion()
  return (
    <section className="relative isolate overflow-hidden border-b border-surface-200 bg-ink-900">
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <Particles
            particleCount={130}
            speed={0.22}
            particleColors={['#f97066', '#7cd4fd', '#ffffff']}
            alphaParticles
            particleBaseSize={1.5}
            sizeRandomness={0.85}
            glow={0.45}
            twinkle={0.3}
            connections={false}
            moveParticlesOnHover={false}
            particleHoverFactor={0}
          />
        </div>
      )}
      {/* Pelo inferior RED→BLUE: la marca, sin ruido */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#d92d20]/50 via-surface-300/30 to-[#0086c9]/50"
      />
      <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-8 pt-9 sm:px-6 sm:pb-9 sm:pt-10 lg:px-8">
        <p className="font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em]">
          <ShinyText
            text="Laboratorio adversarial · RED vs BLUE"
            color="#98a2b3"
            shineColor="#7cd4fd"
            speed={2.6}
            glow={0.4}
          />
        </p>
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <GradientText
              colors={['#f97066', '#ffffff', '#7cd4fd', '#ffffff', '#f97066']}
              animationSpeed={9}
              glow={0.25}
              className="font-display block text-[24px] font-bold tracking-tight sm:text-[30px]"
            >
              Panel de mando
            </GradientText>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#d0d5dd]">
              Ciber range real: los agentes ejecutan comandos verificables contra servicios desplegados, archivan
              conocimiento y evolucionan campaña tras campaña.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono-tight text-[10px] font-bold uppercase tracking-wider text-[#d0d5dd] backdrop-blur-sm">
            <InfinityIcon className={cn('h-3.5 w-3.5', autopilot ? 'text-[#d6bbfb]' : 'text-[#98a2b3]')} />
            {autopilot ? 'Operación continua activa' : 'Motor listo'}
          </span>
        </div>
      </div>
    </section>
  )
}

function DashboardPage() {
  const { state, running, handleStart, toggleAutopilot } = useArena()
  if (!state) return null

  const { stats, agents, liveCampaign } = state
  const avgLevel = agents.length > 0 ? (agents.reduce((acc, a) => acc + a.level, 0) / agents.length).toFixed(1) : '0'
  const totalWins = stats.redWins + stats.blueWins + stats.draws

  return (
    <>
      <HeroBand autopilot={state.autopilot} />
      <PageContainer>

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
              <span className="text-surface-300">·</span>
              <span><b className="font-bold text-[#026aa2]">{stats.blueWins}</b> blue</span>
              <span className="text-surface-300">·</span>
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
              <p className="font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
                {running ? 'Campaña en curso' : liveCampaign ? 'Última campaña' : 'Arena'}
              </p>
              {running && <span className="status-live rounded-full border px-2 py-0.5 font-mono-tight text-[9px] font-bold">EN DIRECTO</span>}
            </div>
            {liveCampaign ? (
              <Link href="/arena" className="group mt-3 block">
                <p className="font-mono-tight text-[13px] font-bold tracking-wide text-ink-900 group-hover:text-[#026aa2]">
                  {liveCampaign.scenario.codename}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
                  {liveCampaign.scenario.company} · {liveCampaign.scenario.industry}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-mono-tight text-[13px] font-extrabold text-[#b42318]">
                    <Crosshair className="h-3 w-3" /> {liveCampaign.redScore}
                  </span>
                  <span className="font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">
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
              <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
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
                <p className="mt-2 text-[12.5px] font-semibold text-ink-900">{l.label}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">{l.desc}</p>
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
            <h2 className="flex items-center gap-2 font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-500">
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
    </>
  )
}

export default function Home() {
  return (
    <ArenaGate>
      <DashboardPage />
    </ArenaGate>
  )
}
