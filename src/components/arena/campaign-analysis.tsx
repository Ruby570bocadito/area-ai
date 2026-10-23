'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Activity, Clock, Layers, Minus, ShieldCheck, Swords, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/text'
import { ARENA_BLUE as BLUE, ARENA_RED as RED } from '@/lib/arena-colors'
import { buildRoundProgression } from '@/lib/round-progression'
import { VICTORY_RULE_SHORT } from '@/lib/victory'
import type { CampaignSiblingDTO, CampaignSummaryDTO, EventDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Secciones de análisis de la ficha de campaña (/historial/[id]):
//
// · RoundEvolution    — evolución ronda a ronda del impacto
//                       acumulado RED/BLUE (backlog 14h39 #4):
//                       curva de momentum, desglose por ronda y
//                       puntos de giro. Los datos salen del
//                       registro de eventos vía el módulo puro
//                       src/lib/round-progression.ts.
// · ScenarioSiblings  — comparativa con las demás campañas del
//                       mismo escenario: marcador, progreso,
//                       duración y medias del escenario.
// ─────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/* ---------- Evolución ronda a ronda ---------- */

export function RoundEvolution({ events, maxRounds }: { events: EventDTO[]; maxRounds: number }) {
  const p = useMemo(() => buildRoundProgression(events, maxRounds), [events, maxRounds])

  const W = 340
  const H = 140
  const PAD_X = 12
  const PAD_Y = 16

  const { max, redPts, bluePts, redPath, bluePath } = useMemo(() => {
    const max = Math.max(30, p.redTotal, p.blueTotal)
    const px = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, p.rows.length - 1)
    const py = (v: number) => H - PAD_Y - (v / max) * (H - 2 * PAD_Y)
    const redPts = p.rows.map((r, i) => ({ x: px(i), y: py(r.redCumulative), r }))
    const bluePts = p.rows.map((r, i) => ({ x: px(i), y: py(r.blueCumulative), r }))
    const line = (pts: { x: number; y: number }[]) =>
      pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
    return { max, redPts, bluePts, redPath: line(redPts), bluePath: line(bluePts) }
  }, [p])

  const momentumNote = (() => {
    if (p.isEmpty) return null
    if (p.turningPoints.length > 0) {
      return `Momentum changed hands in round ${p.turningPoints.join(' and in round ')}.`
    }
    if (p.redTotal === p.blueTotal) return 'Impact matched from start to finish: a tactical draw in activity.'
    return `${p.redTotal > p.blueTotal ? 'RED' : 'BLUE'} led the impact from start to finish.`
  })()

  return (
    <section className="mt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Activity className="h-4 w-4 text-ink-500" />
        <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.2em] text-ink-600">
          Round-by-round evolution
        </h3>
        <span className="rounded-full border border-surface-200 bg-white px-2 py-0.5 font-mono-tight text-[9.5px] font-bold text-ink-500">
          {p.roundsPlayed}/{maxRounds} rounds with activity
        </span>
      </div>

      {p.isEmpty ? (
        <p className="panel rounded-xl px-4 py-5 text-center text-[12.5px] text-ink-500">
          This campaign does not record team actions yet — the evolution will appear with the first
          events.
        </p>
      ) : (
        <div className="panel rounded-xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3 font-mono-tight text-[10px] text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full" style={{ background: RED }} /> RED
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full" style={{ background: BLUE }} /> BLUE
              </span>
            </div>
            <span className="font-mono-tight text-[9.5px] uppercase tracking-wider text-ink-400">
              accumulated impact · max {max}
            </span>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full overflow-visible" role="img" aria-label="Accumulated impact curve per round for RED and BLUE">
            <title>Each team's accumulated impact across the rounds</title>
            <defs>
              <linearGradient id="rondas-red" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity="0.14" />
                <stop offset="100%" stopColor={RED} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rondas-blue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BLUE} stopOpacity="0.12" />
                <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PAD_X}
                x2={W - PAD_X}
                y1={PAD_Y + f * (H - 2 * PAD_Y)}
                y2={PAD_Y + f * (H - 2 * PAD_Y)}
                stroke="rgba(16,24,40,0.07)"
                strokeDasharray="3 5"
              />
            ))}
            {p.rows.map((r, i) => {
              const x = PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, p.rows.length - 1)
              return (
                <text key={`x-${r.round}`} x={x} y={H - 2} textAnchor="middle" className="fill-ink-400 font-mono-tight" fontSize="8">
                  R{r.round}
                </text>
              )
            })}
            <motion.path
              d={`${redPath} L${redPts[redPts.length - 1].x.toFixed(1)},${H - PAD_Y} L${redPts[0].x.toFixed(1)},${H - PAD_Y} Z`}
              fill="url(#rondas-red)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
            />
            <motion.path
              d={`${bluePath} L${bluePts[bluePts.length - 1].x.toFixed(1)},${H - PAD_Y} L${bluePts[0].x.toFixed(1)},${H - PAD_Y} Z`}
              fill="url(#rondas-blue)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
            />
            <motion.path
              d={redPath}
              fill="none"
              stroke={RED}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            />
            <motion.path
              d={bluePath}
              fill="none"
              stroke={BLUE}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 1.2, delay: 0.2, ease: 'easeInOut' }}
            />
            {redPts.map((pt, i) => (
              <motion.circle
                key={`r-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3"
                fill="#ffffff"
                stroke={RED}
                strokeWidth="1.8"
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.06, type: 'spring', stiffness: 300, damping: 18 }}
              >
                <title>{`Round ${pt.r.round} · RED ${pt.r.redCumulative} cumulative pts (${pt.r.redActions} actions)`}</title>
              </motion.circle>
            ))}
            {bluePts.map((pt, i) => (
              <motion.circle
                key={`b-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3"
                fill="#ffffff"
                stroke={BLUE}
                strokeWidth="1.8"
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.06, type: 'spring', stiffness: 300, damping: 18 }}
              >
                <title>{`Round ${pt.r.round} · BLUE ${pt.r.blueCumulative} cumulative pts (${pt.r.blueActions} actions)`}</title>
              </motion.circle>
            ))}
          </svg>

          {/* Desglose por ronda */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {p.rows.map((r) => (
              <div
                key={r.round}
                className={cn(
                  'rounded-lg border px-2 py-1.5',
                  r.leader === 'RED'
                    ? 'border-[#fecdca] bg-[#fef3f2]'
                    : r.leader === 'BLUE'
                      ? 'border-[#b2ddff] bg-[#f0f9ff]'
                      : 'border-surface-200 bg-surface-50'
                )}
                title={`Round ${r.round}: RED ${r.redActions} actions (+${r.redImpact}) with ${r.redHits} hits · BLUE ${r.blueActions} actions (+${r.blueImpact}) with ${r.blueHits} hits`}
              >
                <p className="font-mono-tight text-[9px] font-bold uppercase tracking-wider text-ink-400">R{r.round}</p>
                <p className="font-mono-tight text-[10.5px] font-bold text-[#b42318]">▲ {r.redImpact}</p>
                <p className="font-mono-tight text-[10.5px] font-bold text-[#026aa2]">▼ {r.blueImpact}</p>
              </div>
            ))}
          </div>

          <p className="mt-2.5 flex items-center gap-1.5 font-mono-tight text-[10px] text-ink-500">
            {p.turningPoints.length > 0 && <TrendingUp className="h-3 w-3 text-[#b54708]" />}
            {momentumNote}
          </p>
          <p className="mt-1 font-mono-tight text-[9px] text-surface-300">
            impacto verificado contra el laboratorio (suma de impactos de eventos) · el ganador se decide por progreso de objetivos
          </p>
        </div>
      )}
    </section>
  )
}

/* ---------- Comparativa con campañas del mismo escenario ---------- */

function SiblingBadge({ status, winner }: { status: string; winner: string | null }) {
  if (status === 'RUNNING')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#fec84b] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]">
        IN PROGRESS
      </span>
    )
  if (status !== 'COMPLETED')
    return (
      <span className="flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-ink-500">
        ABORTED
      </span>
    )
  if (winner === 'RED')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#fecdca] bg-[#fef3f2] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b42318]">
        <Swords className="h-2.5 w-2.5" /> RED WINS
      </span>
    )
  if (winner === 'BLUE')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#b2ddff] bg-[#f0f9ff] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#026aa2]">
        <ShieldCheck className="h-2.5 w-2.5" /> BLUE WINS
      </span>
    )
  return (
    <span className="flex items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]">
      <Minus className="h-2.5 w-2.5" /> DRAW
    </span>
  )
}

export function ScenarioSiblings({
  current,
  siblings,
}: {
  current: CampaignSummaryDTO
  siblings: CampaignSiblingDTO[]
}) {
  // La campaña actual encabeza la comparativa; las hermanas llegan desc por fecha
  const rows = useMemo(
    () => [
      {
        id: current.id,
        status: current.status,
        winner: current.winner,
        redProgress: current.redProgress,
        blueProgress: current.blueProgress,
        redScore: current.redScore,
        blueScore: current.blueScore,
        startedAt: current.startedAt,
        endedAt: current.endedAt,
        isCurrent: true,
      },
      ...siblings.map((s) => ({ ...s, isCurrent: false })),
    ],
    [current, siblings]
  )

  const completed = rows.filter((r) => r.status === 'COMPLETED')
  const avg = (nums: number[]) => (nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null)
  const avgRed = avg(completed.map((r) => r.redScore))
  const avgBlue = avg(completed.map((r) => r.blueScore))
  const avgRedProgress = avg(completed.map((r) => r.redProgress))
  const avgBlueProgress = avg(completed.map((r) => r.blueProgress))

  return (
    <section className="mt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Layers className="h-4 w-4 text-ink-500" />
        <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.2em] text-ink-600">
          Sibling campaigns in this scenario
        </h3>
        <span className="rounded-full border border-surface-200 bg-white px-2 py-0.5 font-mono-tight text-[9.5px] font-bold text-ink-500">
          {rows.length} · {current.scenario.codename}
        </span>
      </div>

      <div className="panel overflow-hidden rounded-xl">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5',
              i > 0 && 'border-t border-surface-100',
              r.isCurrent ? 'bg-[#fffaeb]/60' : 'panel-hover'
            )}
          >
            <SiblingBadge status={r.status} winner={r.winner} />
            {r.isCurrent && (
              <span className="rounded bg-ink-900 px-1.5 py-0.5 font-mono-tight text-[8.5px] font-bold uppercase tracking-wider text-white">
                this campaign
              </span>
            )}
            <span className="flex items-center gap-3 font-mono-tight text-[10.5px] text-ink-600">
              <span title="RED · BLUE score">
                <b className="text-[#b42318]">{r.redScore}</b>
                <span className="text-surface-300"> · </span>
                <b className="text-[#026aa2]">{r.blueScore}</b> pts
              </span>
              <span title="RED · BLUE objective progress">
                {r.redProgress}/{r.blueProgress} of 100
              </span>
            </span>
            <span className="ml-auto flex items-center gap-3 font-mono-tight text-[10px] text-ink-400">
              <span className="flex items-center gap-1" title="Duration">
                <Clock className="h-3 w-3" /> {formatDuration(r.endedAt ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime() : NaN)}
              </span>
              <span>{fmtDate(r.startedAt)}</span>
              {!r.isCurrent && (
                <Link
                  href={`/historial/${r.id}`}
                  className="rounded-md border border-surface-200 bg-white px-2 py-0.5 font-bold text-ink-500 transition-colors hover:border-surface-300 hover:text-ink-900"
                >
                  View record
                </Link>
              )}
            </span>
          </div>
        ))}
        <p className="border-t border-surface-100 bg-surface-50/60 px-3.5 py-2 font-mono-tight text-[9.5px] text-ink-500">
          {siblings.length === 0
            ? 'This is the first recorded campaign of this scenario.'
            : `Scenario average (${completed.length} finished): RED ${avgRed ?? '—'} pts · BLUE ${avgBlue ?? '—'} pts · progress ${avgRedProgress ?? '—'}/${avgBlueProgress ?? '—'} of 100`}
          {' · '}
          {VICTORY_RULE_SHORT}
        </p>
      </div>
    </section>
  )
}
