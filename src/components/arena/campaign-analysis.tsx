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
      return `El momentum cambió de manos en la ronda ${p.turningPoints.join(' y en la ronda ')}.`
    }
    if (p.redTotal === p.blueTotal) return 'Impacto igualado de principio a fin: empate táctico en actividad.'
    return `${p.redTotal > p.blueTotal ? 'RED' : 'BLUE'} lideró el impacto de principio a fin.`
  })()

  return (
    <section className="mt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#667085]" />
        <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.2em] text-[#475467]">
          Evolución ronda a ronda
        </h3>
        <span className="rounded-full border border-[#e4e7ec] bg-white px-2 py-0.5 font-mono-tight text-[9.5px] font-bold text-[#667085]">
          {p.roundsPlayed}/{maxRounds} rondas con actividad
        </span>
      </div>

      {p.isEmpty ? (
        <p className="panel rounded-xl px-4 py-5 text-center text-[12.5px] text-[#667085]">
          Esta campaña aún no registra acciones de los equipos — la evolución aparecerá con los primeros
          eventos.
        </p>
      ) : (
        <div className="panel rounded-xl p-4">
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
              impacto acumulado · máx {max}
            </span>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full overflow-visible" role="img" aria-label="Curva de impacto acumulado por ronda de RED y BLUE">
            <title>Impacto acumulado de cada equipo a lo largo de las rondas</title>
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
                <text key={`x-${r.round}`} x={x} y={H - 2} textAnchor="middle" className="fill-[#98a2b3] font-mono-tight" fontSize="8">
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
                <title>{`Ronda ${pt.r.round} · RED ${pt.r.redCumulative} pts acumulados (${pt.r.redActions} acciones)`}</title>
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
                <title>{`Ronda ${pt.r.round} · BLUE ${pt.r.blueCumulative} pts acumulados (${pt.r.blueActions} acciones)`}</title>
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
                      : 'border-[#e4e7ec] bg-[#f9fafb]'
                )}
                title={`Ronda ${r.round}: RED ${r.redActions} acciones (+${r.redImpact}) con ${r.redHits} aciertos · BLUE ${r.blueActions} acciones (+${r.blueImpact}) con ${r.blueHits} aciertos`}
              >
                <p className="font-mono-tight text-[9px] font-bold uppercase tracking-wider text-[#98a2b3]">R{r.round}</p>
                <p className="font-mono-tight text-[10.5px] font-bold text-[#b42318]">▲ {r.redImpact}</p>
                <p className="font-mono-tight text-[10.5px] font-bold text-[#026aa2]">▼ {r.blueImpact}</p>
              </div>
            ))}
          </div>

          <p className="mt-2.5 flex items-center gap-1.5 font-mono-tight text-[10px] text-[#667085]">
            {p.turningPoints.length > 0 && <TrendingUp className="h-3 w-3 text-[#b54708]" />}
            {momentumNote}
          </p>
          <p className="mt-1 font-mono-tight text-[9px] text-[#d0d5dd]">
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
        EN CURSO
      </span>
    )
  if (status !== 'COMPLETED')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#667085]">
        ABORTADA
      </span>
    )
  if (winner === 'RED')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#fecdca] bg-[#fef3f2] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b42318]">
        <Swords className="h-2.5 w-2.5" /> GANA RED
      </span>
    )
  if (winner === 'BLUE')
    return (
      <span className="flex items-center gap-1 rounded-full border border-[#b2ddff] bg-[#f0f9ff] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#026aa2]">
        <ShieldCheck className="h-2.5 w-2.5" /> GANA BLUE
      </span>
    )
  return (
    <span className="flex items-center gap-1 rounded-full border border-[#fedf89] bg-[#fffaeb] px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#b54708]">
      <Minus className="h-2.5 w-2.5" /> EMPATE
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
        <Layers className="h-4 w-4 text-[#667085]" />
        <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.2em] text-[#475467]">
          Otras campañas en este escenario
        </h3>
        <span className="rounded-full border border-[#e4e7ec] bg-white px-2 py-0.5 font-mono-tight text-[9.5px] font-bold text-[#667085]">
          {rows.length} · {current.scenario.codename}
        </span>
      </div>

      <div className="panel overflow-hidden rounded-xl">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5',
              i > 0 && 'border-t border-[#f2f4f7]',
              r.isCurrent ? 'bg-[#fffaeb]/60' : 'panel-hover'
            )}
          >
            <SiblingBadge status={r.status} winner={r.winner} />
            {r.isCurrent && (
              <span className="rounded bg-[#101828] px-1.5 py-0.5 font-mono-tight text-[8.5px] font-bold uppercase tracking-wider text-white">
                esta campaña
              </span>
            )}
            <span className="flex items-center gap-3 font-mono-tight text-[10.5px] text-[#475467]">
              <span title="Puntuación RED · BLUE">
                <b className="text-[#b42318]">{r.redScore}</b>
                <span className="text-[#d0d5dd]"> · </span>
                <b className="text-[#026aa2]">{r.blueScore}</b> pts
              </span>
              <span title="Progreso de objetivos RED · BLUE">
                {r.redProgress}/{r.blueProgress} de 100
              </span>
            </span>
            <span className="ml-auto flex items-center gap-3 font-mono-tight text-[10px] text-[#98a2b3]">
              <span className="flex items-center gap-1" title="Duración">
                <Clock className="h-3 w-3" /> {formatDuration(r.endedAt ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime() : NaN)}
              </span>
              <span>{fmtDate(r.startedAt)}</span>
              {!r.isCurrent && (
                <Link
                  href={`/historial/${r.id}`}
                  className="rounded-md border border-[#e4e7ec] bg-white px-2 py-0.5 font-bold text-[#667085] transition-colors hover:border-[#d0d5dd] hover:text-[#101828]"
                >
                  Ver ficha
                </Link>
              )}
            </span>
          </div>
        ))}
        <p className="border-t border-[#f2f4f7] bg-[#f9fafb]/60 px-3.5 py-2 font-mono-tight text-[9.5px] text-[#667085]">
          {siblings.length === 0
            ? 'Es la primera campaña registrada de este escenario.'
            : `Media del escenario (${completed.length} finalizadas): RED ${avgRed ?? '—'} pts · BLUE ${avgBlue ?? '—'} pts · progreso ${avgRedProgress ?? '—'}/${avgBlueProgress ?? '—'} de 100`}
          {' · '}
          {VICTORY_RULE_SHORT}
        </p>
      </div>
    </section>
  )
}
