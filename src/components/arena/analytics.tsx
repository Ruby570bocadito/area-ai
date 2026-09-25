'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronRight, Trophy, TrendingUp, BrainCircuit, Crown, Target, Sparkles, Map } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_BLUE as BLUE, ARENA_RED as RED } from '@/lib/arena-colors'
import { AgentAvatar } from './agent-avatar'
import { buildScenarioStats } from '@/lib/scenario-stats'
import type { AgentDTO, CampaignListItemDTO, KnowledgeDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// /analitica — gráficos SVG animados a medida
// ─────────────────────────────────────────────────────────────

const AMBER = '#d97706'

/* ---------- Donut de resultados ---------- */
function OutcomeDonut({ red, blue, draws }: { red: number; blue: number; draws: number }) {
  const total = red + blue + draws
  const R = 52
  const C = 2 * Math.PI * R
  const segs = useMemo(() => {
    if (total === 0) return []
    const vals = [
      { v: red, color: RED, label: 'Victorias RED' },
      { v: blue, color: BLUE, label: 'Victorias BLUE' },
      { v: draws, color: AMBER, label: 'Empates' },
    ]
    let acc = 0
    return vals.map((s) => {
      const frac = s.v / total
      const seg = { ...s, frac, offset: acc }
      acc += frac
      return seg
    })
  }, [red, blue, draws, total])

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[132px] w-[132px] shrink-0">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle cx="66" cy="66" r={R} fill="none" stroke="#f2f4f7" strokeWidth="13" />
          {segs.map((s, i) =>
            s.v > 0 ? (
              <motion.circle
                key={s.label}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="13"
                strokeLinecap="butt"
                strokeDasharray={`${s.frac * C} ${C}`}
                initial={{ strokeDashoffset: C }}
                whileInView={{ strokeDashoffset: -s.offset * C }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="font-display text-2xl font-extrabold text-[#101828]"
          >
            {total}
          </motion.span>
          <span className="font-mono-tight text-[8.5px] uppercase tracking-[0.22em] text-[#98a2b3]">
            campañas
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {[
          { color: RED, label: 'Victorias RED', v: red, filter: 'RED' },
          { color: BLUE, label: 'Victorias BLUE', v: blue, filter: 'BLUE' },
          { color: AMBER, label: 'Empates', v: draws, filter: 'DRAW' },
        ].map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35 + i * 0.12, duration: 0.45 }}
          >
            <Link
              href={`/historial?resultado=${row.filter}`}
              className="group flex items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-[#f9fafb]"
              aria-label={`Ver en el historial las campañas filtradas por ${row.label}`}
              title={`Abrir el historial filtrado: ${row.label}`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: row.color }} />
              <span className="flex-1 truncate font-mono-tight text-[11px] text-[#667085] group-hover:text-[#101828] group-hover:underline group-hover:underline-offset-2">
                {row.label}
              </span>
              <span className="font-mono-tight text-sm font-bold text-[#101828]">{row.v}</span>
              <span className="w-10 text-right font-mono-tight text-[10px] text-[#98a2b3]">
                {total > 0 ? Math.round((row.v / total) * 100) : 0}%
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-[#d0d5dd] transition-all group-hover:translate-x-0.5 group-hover:text-[#98a2b3]" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Curva de evolución de puntuaciones ---------- */
function EvolutionChart({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  const router = useRouter()
  const data = useMemo(() => {
    return campaigns
      .filter((c) => c.status === 'COMPLETED')
      .slice()
      .sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt))
      .slice(-10)
  }, [campaigns])

  const W = 320
  const H = 130
  const PAD_X = 8
  const PAD_Y = 14

  const { max, redPts, bluePts, redPath, redArea, bluePath, blueArea } = useMemo(() => {
    if (data.length === 0) return { max: 100, redPts: [], bluePts: [], redPath: '', redArea: '', bluePath: '', blueArea: '' }
    const max = Math.max(100, ...data.map((c) => Math.max(c.redScore, c.blueScore)))
    const px = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, data.length - 1)
    const py = (v: number) => H - PAD_Y - (v / max) * (H - 2 * PAD_Y)
    const redPts = data.map((c, i) => ({ x: px(i), y: py(c.redScore), c }))
    const bluePts = data.map((c, i) => ({ x: px(i), y: py(c.blueScore), c }))
    const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const area = (pts: { x: number; y: number }[]) =>
      `${line(pts)} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD_Y} L${pts[0].x.toFixed(1)},${H - PAD_Y} Z`
    return { max, redPts, bluePts, redPath: line(redPts), redArea: area(redPts), bluePath: line(bluePts), blueArea: area(bluePts) }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[12px] text-[#98a2b3]">
        Lanza campañas para ver la curva de evolución.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 font-mono-tight text-[10px] text-[#667085]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full" style={{ background: RED }} /> RED
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full" style={{ background: BLUE }} /> BLUE
          </span>
        </div>
        <span className="font-mono-tight text-[9.5px] uppercase tracking-wider text-[#98a2b3]">
          últimas {data.length} · máx {max}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full overflow-visible">
        <title>Haz clic en un punto para abrir la ficha de esa campaña</title>
        <defs>
          <linearGradient id="evol-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity="0.18" />
            <stop offset="100%" stopColor={RED} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="evol-blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.16" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD_X} x2={W - PAD_X} y1={PAD_Y + f * (H - 2 * PAD_Y)} y2={PAD_Y + f * (H - 2 * PAD_Y)} stroke="rgba(16,24,40,0.07)" strokeDasharray="3 5" />
        ))}
        <motion.path d={redArea} fill="url(#evol-red)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.7 }} />
        <motion.path d={blueArea} fill="url(#evol-blue)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.7 }} />
        <motion.path d={redPath} fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 1.3, ease: 'easeInOut' }} />
        <motion.path d={bluePath} fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 1.3, delay: 0.2, ease: 'easeInOut' }} />
        {redPts.map((p, i) => (
          <motion.circle
            key={`r-${i}`}
            cx={p.x}
            cy={p.y}
            r="3.2"
            fill="#ffffff"
            stroke={RED}
            strokeWidth="1.8"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.55 + i * 0.07, type: 'spring', stiffness: 300, damping: 18 }}
            whileHover={{ r: 5.5 }}
            className="cursor-pointer"
            onClick={() => router.push(`/historial/${p.c.id}`)}
            role="link"
            aria-label={`Abrir ficha de la campaña ${p.c.scenario.codename}`}
          >
            <title>{`${p.c.scenario.codename} — RED ${p.c.redScore} pts · clic para abrir la ficha`}</title>
          </motion.circle>
        ))}
        {bluePts.map((p, i) => (
          <motion.circle
            key={`b-${i}`}
            cx={p.x}
            cy={p.y}
            r="3.2"
            fill="#ffffff"
            stroke={BLUE}
            strokeWidth="1.8"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.65 + i * 0.07, type: 'spring', stiffness: 300, damping: 18 }}
            whileHover={{ r: 5.5 }}
            className="cursor-pointer"
            onClick={() => router.push(`/historial/${p.c.id}`)}
            role="link"
            aria-label={`Abrir ficha de la campaña ${p.c.scenario.codename}`}
          >
            <title>{`${p.c.scenario.codename} — BLUE ${p.c.blueScore} pts · clic para abrir la ficha`}</title>
          </motion.circle>
        ))}
      </svg>
      <p className="mt-1 text-right font-mono-tight text-[9px] text-[#d0d5dd]">
        clic en un punto → ficha de la campaña
      </p>
    </div>
  )
}

/* ---------- Leaderboard de agentes ---------- */
function Leaderboard({ agents }: { agents: AgentDTO[] }) {
  const top = useMemo(() => [...agents].sort((a, b) => b.xp - a.xp).slice(0, 6), [agents])
  const maxXp = Math.max(1, ...top.map((a) => a.xp))
  return (
    <div className="space-y-3">
      {top.map((a, i) => {
        const isRed = a.team === 'RED'
        return (
          <motion.div
            key={a.key}
            initial={{ opacity: 0, x: 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
            className="group"
          >
            <div className="mb-1 flex items-center gap-2.5">
              <span className={cn('w-5 shrink-0 text-center font-mono-tight text-[11px] font-bold', i === 0 ? 'text-[#b54708]' : 'text-[#98a2b3]')}>
                {i + 1}
              </span>
              <AgentAvatar agent={a} size="sm" />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-mono-tight text-[11.5px] font-bold', isRed ? 'text-[#b42318]' : 'text-[#026aa2]')}>
                  {a.codename}
                </p>
                <p className="truncate text-[10px] text-[#667085]">{a.role}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono-tight text-[11px] font-bold text-[#101828]">{a.xp} XP</p>
                <p className="font-mono-tight text-[9px] text-[#98a2b3]">
                  {a.victories}🏆 · Nv{a.level}
                </p>
              </div>
            </div>
            <div className="ml-7 h-1 overflow-hidden rounded-full bg-[#f2f4f7]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: isRed ? RED : BLUE }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(a.xp / maxXp) * 100}%` }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ---------- Efectividad del conocimiento ---------- */
function KnowledgeEffectiveness({ items, team }: { items: KnowledgeDTO[]; team: 'RED' | 'BLUE' }) {
  const isRed = team === 'RED'
  const top = useMemo(
    () =>
      items
        .filter((k) => k.timesUsed > 0)
        .sort((a, b) => b.timesWorked / b.timesUsed - a.timesWorked / a.timesUsed || b.timesUsed - a.timesUsed)
        .slice(0, 3),
    [items]
  )
  if (top.length === 0) {
    return (
      <p className="flex h-full min-h-[80px] items-center justify-center px-4 text-center text-[11.5px] text-[#98a2b3]">
        Sin usos registrados todavía — se activará cuando los agentes apliquen estas lecciones en combate.
      </p>
    )
  }
  return (
    <div className="space-y-2.5">
      {top.map((k, i) => {
        const rate = Math.round((k.timesWorked / k.timesUsed) * 100)
        return (
          <motion.div
            key={k.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.09, duration: 0.4 }}
            className="rounded-lg border border-[#f2f4f7] bg-[#f9fafb] p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11.5px] font-medium text-[#101828]">{k.title}</p>
              <span className={cn('shrink-0 font-mono-tight text-[10px] font-bold', isRed ? 'text-[#b42318]' : 'text-[#026aa2]')}>
                {rate}%
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                <motion.div
                  className={cn('h-full rounded-full', isRed ? 'bg-[#d92d20]' : 'bg-[#0086c9]')}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${rate}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.25 + i * 0.09 }}
                />
              </div>
              <span className="shrink-0 font-mono-tight text-[9px] text-[#667085]">
                {k.timesWorked}/{k.timesUsed} usos · conf {Math.round(k.confidence * 100)}%
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ---------- Balance por escenario (Ronda 12) ---------- */
// Agregación por escenario con deep-link al historial prefiltrado:
// cada fila enlaza a /historial?escenario=<codename> (el panel de
// historial valida el codename al cargar y degrada a «Todos» si el
// enlace es viejo). La lógica vive en src/lib/scenario-stats.ts
// (módulo puro, contrato fijado en tests/scenario-stats.test.ts).
function ScenarioMatrix({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  const rows = useMemo(() => buildScenarioStats(campaigns), [campaigns])

  if (rows.length === 0) {
    return (
      <div className="flex h-[100px] items-center justify-center text-[12px] text-[#98a2b3]">
        Lanza campañas para ver el balance por escenario.
      </div>
    )
  }

  return (
    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((s, i) => {
        const drawPct = Math.max(0, 100 - s.redPct - s.bluePct)
        return (
          <motion.div
            key={s.codename}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.4 }}
          >
            <Link
              href={`/historial?escenario=${encodeURIComponent(s.codename)}`}
              className="group flex h-full flex-col gap-2.5 rounded-xl border border-[#f2f4f7] bg-[#f9fafb] p-3 transition-colors hover:border-[#e4e7ec] hover:bg-white"
              aria-label={`Abrir el historial filtrado por el escenario ${s.codename}`}
              title={`Abrir el historial prefiltrado: ${s.codename}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono-tight text-[11.5px] font-bold tracking-wide text-[#101828] group-hover:underline group-hover:underline-offset-2">
                    {s.codename}
                  </p>
                  <p className="truncate text-[10px] text-[#667085]">
                    {s.company} · dificultad {s.difficulty}/5
                  </p>
                </div>
                <span className="shrink-0 font-mono-tight text-[9.5px] text-[#98a2b3]">
                  {s.total} campaña{s.total === 1 ? '' : 's'}
                </span>
              </div>

              {/* Barra apilada del balance sobre finalizadas */}
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#f2f4f7]">
                {s.redPct > 0 && <div style={{ width: `${s.redPct}%`, background: RED }} />}
                {s.bluePct > 0 && <div style={{ width: `${s.bluePct}%`, background: BLUE }} />}
                {drawPct > 0 && <div style={{ width: `${drawPct}%`, background: AMBER }} />}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 font-mono-tight text-[10px]">
                  <span className="font-bold text-[#b42318]" title="Victorias RED">R {s.red}</span>
                  <span className="font-bold text-[#026aa2]" title="Victorias BLUE">B {s.blue}</span>
                  <span className="font-bold text-[#b54708]" title="Empates">E {s.draws}</span>
                  {s.running > 0 && (
                    <span className="text-[#98a2b3]" title="En curso">· {s.running} en curso</span>
                  )}
                </div>
                <span className="flex shrink-0 items-center font-mono-tight text-[9px] text-[#98a2b3]">
                  {s.completed > 0 ? `${s.redPct}% RED` : 'sin datos'}
                  <ChevronRight className="h-3 w-3 text-[#d0d5dd] transition-all group-hover:translate-x-0.5 group-hover:text-[#98a2b3]" />
                </span>
              </div>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ---------- Sección completa ---------- */
export function Analytics({
  agents,
  campaigns,
  knowledge,
  stats,
}: {
  agents: AgentDTO[]
  campaigns: CampaignListItemDTO[]
  knowledge: { red: KnowledgeDTO[]; blue: KnowledgeDTO[] }
  stats: { totalCampaigns: number; redWins: number; blueWins: number; draws: number }
}) {
  const mvp = useMemo(() => [...agents].sort((a, b) => b.xp - a.xp)[0], [agents])
  const redWinRate = stats.totalCampaigns > 0 ? Math.round((stats.redWins / stats.totalCampaigns) * 100) : 0

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Donut + balance */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55 }}
        className="panel relative overflow-hidden rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-[#b54708]" />
          <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.18em] text-[#475467]">
            Balance de victorias
          </h3>
        </div>
        <OutcomeDonut red={stats.redWins} blue={stats.blueWins} draws={stats.draws} />
        {mvp && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[#fedf89] bg-[#fffaeb] p-2.5">
            <Crown className="h-4 w-4 shrink-0 text-[#b54708]" />
            <div className="min-w-0 flex-1">
              <p className="font-mono-tight text-[9px] uppercase tracking-wider text-[#98a2b3]">Agente MVP</p>
              <p className={cn('truncate font-mono-tight text-[11.5px] font-bold', mvp.team === 'RED' ? 'text-[#b42318]' : 'text-[#026aa2]')}>
                {mvp.codename} · {mvp.xp} XP
              </p>
            </div>
            <AgentAvatar agent={mvp} size="sm" />
          </div>
        )}
      </motion.div>

      {/* Curva de evolución */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="panel relative overflow-hidden rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-[#667085]" />
          <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.18em] text-[#475467]">
            Evolución de puntuaciones
          </h3>
        </div>
        <EvolutionChart campaigns={campaigns} />
        <div className="mt-3 flex items-center justify-between border-t border-[#f2f4f7] pt-3">
          <span className="flex items-center gap-1.5 font-mono-tight text-[10px] text-[#667085]">
            <Target className="h-3 w-3 text-[#b42318]" /> RED gana {redWinRate}% de las campañas
          </span>
          <span className="font-mono-tight text-[10px] text-[#667085]">
            {stats.blueWins + stats.redWins + stats.draws > 0
              ? `ventaja ${stats.redWins > stats.blueWins ? 'RED' : stats.blueWins > stats.redWins ? 'BLUE' : '—'}`
              : 'sin datos'}
          </span>
        </div>
      </motion.div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, delay: 0.2 }}
        className="panel relative overflow-hidden rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#b54708]" />
          <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.18em] text-[#475467]">
            Ranking de agentes
          </h3>
        </div>
        <Leaderboard agents={agents} />
      </motion.div>

      {/* Balance por escenario — ancho completo (Ronda 12) */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, delay: 0.18 }}
        className="panel relative overflow-hidden rounded-2xl p-5 lg:col-span-3"
      >
        <div className="mb-4 flex items-center gap-2">
          <Map className="h-3.5 w-3.5 text-[#667085]" />
          <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.18em] text-[#475467]">
            Balance por escenario
          </h3>
          <span className="font-mono-tight text-[9.5px] normal-case tracking-normal text-[#98a2b3]">
            — clic en un escenario para abrir el historial prefiltrado
          </span>
        </div>
        <ScenarioMatrix campaigns={campaigns} />
      </motion.div>

      {/* Efectividad del conocimiento — ancho completo */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, delay: 0.15 }}
        className="panel relative overflow-hidden rounded-2xl p-5 lg:col-span-3"
      >
        <div className="mb-4 flex items-center gap-2">
          <BrainCircuit className="h-3.5 w-3.5 text-[#667085]" />
          <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.18em] text-[#475467]">
            Conocimiento más efectivo
          </h3>
          <span className="font-mono-tight text-[9.5px] normal-case tracking-normal text-[#98a2b3]">
            — lecciones con mayor tasa de éxito al aplicarse en combate
          </span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 font-mono-tight text-[10px] font-bold uppercase tracking-[0.2em] text-[#b42318]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d92d20] pulse-dot" /> Equipo RED
            </p>
            <KnowledgeEffectiveness items={knowledge.red} team="RED" />
          </div>
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 font-mono-tight text-[10px] font-bold uppercase tracking-[0.2em] text-[#026aa2]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0086c9] pulse-dot" /> Equipo BLUE
            </p>
            <KnowledgeEffectiveness items={knowledge.blue} team="BLUE" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
