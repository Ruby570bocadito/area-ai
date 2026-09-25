'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Skull, Crosshair, Bug, Lock, MousePointerClick, X, Server, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDTO, InfraNodeDTO, LiveLabDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Mapa de operaciones — topología real del escenario:
// · Carriles por segmento (DMZ → CORE → AD → CLOUD → OT)
// · Nodos clicables con vulnerabilidades y controles reales
// · Cadena de ataque acumulada (éxitos RED) + haz en curso
// · Estados: comprometido / endurecido / objetivo previsto
// ─────────────────────────────────────────────────────────────

const RED = '#d92d20'
const BLUE = '#0086c9'

const SEG_ORDER = ['DMZ', 'CORE', 'AD', 'CLOUD', 'OT'] as const
const SEG_LABEL: Record<string, string> = {
  DMZ: 'Perímetro',
  CORE: 'Núcleo',
  AD: 'Identidad',
  CLOUD: 'Cloud',
  OT: 'Industrial',
}

const VIEW_W = 880
const VIEW_H = 340

interface NodePos extends InfraNodeDTO {
  x: number
  y: number
  lane: number
}

// Paquete que recorre un haz (SMIL — fiable dentro de SVG)
function BeamPacket({ path, color, dur, delay }: { path: string; color: string; dur: number; delay: number }) {
  return (
    <circle r="2.2" fill={color} opacity="0.9">
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
    </circle>
  )
}

function arc(a: { x: number; y: number }, b: { x: number; y: number }, lift = 40) {
  const mx = (a.x + b.x) / 2
  const my = Math.min(a.y, b.y) - lift
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

function arcDown(a: { x: number; y: number }, b: { x: number; y: number }, lift = 30) {
  const mx = (a.x + b.x) / 2
  const my = Math.max(a.y, b.y) + lift
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

export function NetworkMap({
  nodes,
  events,
  running,
  phase,
  liveLab,
}: {
  nodes: InfraNodeDTO[]
  events: EventDTO[]
  running: boolean
  phase: string
  liveLab?: LiveLabDTO | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Layout dinámico: carriles por segmento presentes ──
  const lanes = useMemo(() => {
    const present = SEG_ORDER.filter((s) => nodes.some((n) => n.segment === s))
    return present.length > 0 ? present : (['CORE'] as const).slice()
  }, [nodes])

  const positions = useMemo<NodePos[]>(() => {
    const padLeft = 190
    const padRight = 170
    const n = Math.max(1, lanes.length)
    const laneX = (i: number) =>
      n === 1 ? (padLeft + (VIEW_W - padRight)) / 2 : padLeft + (i * (VIEW_W - padRight - padLeft)) / (n - 1)
    const byLane = new Map<number, InfraNodeDTO[]>()
    for (const nd of nodes) {
      const li = Math.max(0, lanes.indexOf(nd.segment as (typeof SEG_ORDER)[number]))
      const arr = byLane.get(li) ?? []
      arr.push(nd)
      byLane.set(li, arr)
    }
    const out: NodePos[] = []
    const top = 64
    const bottom = VIEW_H - 40
    for (const [li, arr] of [...byLane.entries()].sort((a, b) => a[0] - b[0])) {
      arr.forEach((nd, i) => {
        out.push({
          ...nd,
          lane: li,
          x: laneX(li),
          y: arr.length === 1 ? (top + bottom) / 2 : top + ((i + 0.5) * (bottom - top)) / arr.length,
        })
      })
    }
    return out
  }, [nodes, lanes])

  const byId = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])

  // ── Estados derivados de eventos reales ──
  const { compromised, hardened, lastRed, lastBlue, chain } = useMemo(() => {
    const comp = new Set<string>()
    const hard = new Set<string>()
    let lr: EventDTO | null = null
    let lb: EventDTO | null = null
    const ch: string[] = []
    for (const ev of events) {
      if (ev.team === 'RED') {
        if ((ev.result === 'EXITO' || ev.result === 'PARCIAL') && ev.targetNode && !comp.has(ev.targetNode)) {
          comp.add(ev.targetNode)
          ch.push(ev.targetNode)
        }
        lr = ev
      } else if (ev.team === 'BLUE') {
        if ((ev.result === 'BLOQUEADO' || ev.result === 'CONTENIDO') && ev.targetNode) hard.add(ev.targetNode)
        lb = ev
      }
    }
    return { compromised: comp, hardened: hard, lastRed: lr, lastBlue: lb, chain: ch }
  }, [events])

  // Nodos previstos para la fase actual (misma regla que el motor)
  const eligible = useMemo(() => {
    const set = new Set<string>()
    if (!running) return set
    for (const n of nodes) {
      if (phase === 'RECON' || phase === 'ARMADO') {
        if (n.segment === 'DMZ') set.add(n.id)
      } else if (phase === 'OBJETIVO') {
        if (n.criticality >= 4) set.add(n.id)
      } else {
        set.add(n.id)
      }
    }
    if (set.size === 0) nodes.forEach((n) => set.add(n.id))
    return set
  }, [nodes, phase, running])

  const RED_BASE = { x: 78, y: 168 }
  const BLUE_BASE = { x: VIEW_W - 74, y: 262 }

  const selected = selectedId ? byId.get(selectedId) ?? null : null
  const labNode = selected ? liveLab?.nodes.find((n) => n.nodeId === selected.id) : undefined
  const labLastExchanges = selected
    ? (liveLab?.lastExchanges ?? []).filter((x) => x.nodeId === selected.id).slice(-3).reverse()
    : []
  const redTarget = lastRed?.targetNode ? byId.get(lastRed.targetNode) : undefined
  const blueTarget = lastBlue?.targetNode ? byId.get(lastBlue.targetNode) : undefined

  return (
    <div className="panel relative overflow-hidden rounded-xl">
      <div className="grid-bg absolute inset-0 opacity-70" />

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="relative z-10 h-auto w-full"
        role="img"
        aria-label="Mapa de red de la campaña con infraestructura real del escenario"
      >
        <defs>
          <radialGradient id="nm-red-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={RED} stopOpacity="0.14" />
            <stop offset="100%" stopColor={RED} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nm-blue-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.14" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nm-red-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={RED} stopOpacity="0.12" />
            <stop offset="1" stopColor={RED} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="nm-blue-beam" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor={BLUE} stopOpacity="0.12" />
            <stop offset="1" stopColor={BLUE} stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* separadores y etiquetas de carril */}
        {lanes.map((seg, i) => {
          const n = Math.max(1, lanes.length)
          const x =
            n === 1 ? (190 + (VIEW_W - 170)) / 2 : 190 + (i * (VIEW_W - 170 - 190)) / (n - 1)
          return (
            <g key={seg}>
              <line x1={x} y1={44} x2={x} y2={VIEW_H - 26} stroke="rgba(16,24,40,0.07)" strokeWidth="1" strokeDasharray="2 6" />
              <text x={x} y={26} textAnchor="middle" fontSize="9.5" fill="#98a2b3" style={{ letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600 }}>
                {SEG_LABEL[seg] ?? seg}
              </text>
            </g>
          )
        })}

        {/* conexiones estructurales entre carriles adyacentes */}
        {positions.map((a) =>
          positions
            .filter((b) => b.lane === a.lane + 1)
            .map((b) => (
              <path
                key={`${a.id}~${b.id}`}
                d={arc(a, b, 26)}
                fill="none"
                stroke="rgba(16,24,40,0.12)"
                strokeWidth="1"
              />
            ))
        )}

        {/* cadena de ataque acumulada (éxitos RED) */}
        {chain.length > 0 && (
          <g fill="none" stroke={RED} strokeWidth="1.3" opacity="0.38">
            {chain.map((id, i) => {
              const prev = i === 0 ? RED_BASE : byId.get(chain[i - 1])
              const cur = byId.get(id)
              if (!prev || !cur || (prev.x === cur.x && prev.y === cur.y)) return null
              return <path key={`${id}-${i}`} d={arc(prev, cur, 34)} strokeDasharray="3 5" />
            })}
          </g>
        )}

        {/* haz RED en curso + paquetes + impacto */}
        {redTarget && (
          <g key={`red-${lastRed?.id ?? 'idle'}`}>
            <path d={arc(RED_BASE, redTarget, 40)} fill="none" stroke="url(#nm-red-beam)" strokeWidth="2" className="attack-beam" style={{ filter: `drop-shadow(0 1px 3px ${RED}55)` }} />
            {running && (
              <>
                <BeamPacket path={arc(RED_BASE, redTarget, 40)} color={RED} dur={1.5} delay={0} />
                <BeamPacket path={arc(RED_BASE, redTarget, 40)} color="#f97066" dur={1.5} delay={0.75} />
              </>
            )}
            <motion.circle
              cx={redTarget.x}
              cy={redTarget.y}
              r={15 + redTarget.criticality}
              fill="none"
              stroke={RED}
              strokeWidth="2"
              initial={{ opacity: 0.9, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          </g>
        )}

        {/* haz BLUE en curso */}
        {blueTarget && (
          <g key={`blue-${lastBlue?.id ?? 'idle'}`}>
            <path d={arcDown(BLUE_BASE, blueTarget, 30)} fill="none" stroke="url(#nm-blue-beam)" strokeWidth="2" className="attack-beam" style={{ filter: `drop-shadow(0 1px 3px ${BLUE}55)` }} />
            {running && (
              <>
                <BeamPacket path={arcDown(BLUE_BASE, blueTarget, 30)} color={BLUE} dur={1.5} delay={0.2} />
                <BeamPacket path={arcDown(BLUE_BASE, blueTarget, 30)} color="#36bffa" dur={1.5} delay={0.95} />
              </>
            )}
          </g>
        )}

        {/* base RED */}
        <g>
          <circle cx={RED_BASE.x} cy={RED_BASE.y} r="44" fill="url(#nm-red-glow)" />
          <circle cx={RED_BASE.x} cy={RED_BASE.y} r="16" fill="#fef3f2" stroke={RED} strokeWidth="2" className={running ? 'svg-pulse-soft' : ''} />
          <text x={RED_BASE.x} y={RED_BASE.y + 4} textAnchor="middle" fontSize="11" fill="#b42318" fontWeight="bold">R</text>
          <text x={RED_BASE.x} y={RED_BASE.y + 34} textAnchor="middle" fontSize="8.5" fill="#b42318" opacity="0.75" style={{ letterSpacing: '0.18em', fontWeight: 700 }}>
            RED ORIGIN
          </text>
        </g>

        {/* base BLUE (SOC) */}
        <g>
          <circle cx={BLUE_BASE.x} cy={BLUE_BASE.y} r="44" fill="url(#nm-blue-glow)" />
          <circle cx={BLUE_BASE.x} cy={BLUE_BASE.y} r="16" fill="#f0f9ff" stroke={BLUE} strokeWidth="2" className={running ? 'svg-pulse-soft' : ''} />
          <text x={BLUE_BASE.x} y={BLUE_BASE.y + 4} textAnchor="middle" fontSize="11" fill="#026aa2" fontWeight="bold">B</text>
          <text x={BLUE_BASE.x} y={BLUE_BASE.y + 34} textAnchor="middle" fontSize="8.5" fill="#026aa2" opacity="0.75" style={{ letterSpacing: '0.18em', fontWeight: 700 }}>
            SOC
          </text>
        </g>

        {/* nodos de infraestructura — clicables */}
        {positions.map((nd) => {
          const isComp = compromised.has(nd.id)
          const isHard = hardened.has(nd.id)
          const isSel = selectedId === nd.id
          const isRedTarget = lastRed?.targetNode === nd.id
          const isBlueTarget = lastBlue?.targetNode === nd.id
          const isEligible = eligible.has(nd.id)
          const r = 11 + nd.criticality
          const stroke = isComp ? RED : isHard ? BLUE : 'rgba(16,24,40,0.22)'
          return (
            <g
              key={nd.id}
              onClick={() => setSelectedId(isSel ? null : nd.id)}
              className="cursor-pointer"
              role="button"
              aria-label={`${nd.name}, segmento ${SEG_LABEL[nd.segment] ?? nd.segment}, criticidad ${nd.criticality} de 5`}
            >
              {/* objetivo previsto para la fase */}
              {isEligible && !isComp && (
                <circle cx={nd.x} cy={nd.y} r={r + 7} fill="none" stroke="rgba(217,119,6,0.45)" strokeWidth="1" strokeDasharray="3 4" />
              )}
              {(isRedTarget || isBlueTarget) && (
                <circle cx={nd.x} cy={nd.y} r={r + 5} fill="none" stroke={isRedTarget ? RED : BLUE} strokeWidth="1.4" className="svg-pulse-soft" />
              )}
              <circle
                cx={nd.x}
                cy={nd.y}
                r={r}
                fill={isComp ? '#fef3f2' : isHard ? '#f0f9ff' : '#ffffff'}
                stroke={isSel ? '#101828' : stroke}
                strokeWidth={isSel ? 2 : isComp || isHard ? 2 : 1.2}
                style={{
                  filter: isComp ? `drop-shadow(0 1px 4px ${RED}66)` : isHard ? `drop-shadow(0 1px 4px ${BLUE}55)` : 'drop-shadow(0 1px 2px rgba(16,24,40,0.08))',
                  transition: 'stroke 0.2s ease',
                }}
              />
              <text x={nd.x} y={nd.y + 3} textAnchor="middle" fontSize="7.5" fill={isComp ? '#b42318' : isHard ? '#026aa2' : '#667085'} style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                {nd.type.slice(0, 6)}
              </text>
              <text x={nd.x} y={nd.y + r + 13} textAnchor="middle" fontSize="9" fill="#344054">
                {nd.name.length > 24 ? nd.name.slice(0, 23) + '…' : nd.name}
              </text>
              <text x={nd.x} y={nd.y - r - 6} textAnchor="middle" fontSize="7.5" fill="#98a2b3" className="font-mono-tight">
                {nd.ip}
              </text>
            </g>
          )
        })}
      </svg>

      {/* leyenda + contadores */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#f2f4f7] px-3.5 py-2.5 font-mono-tight text-[10px] text-[#667085]">
        <span className="flex items-center gap-1.5">
          <Skull className="h-3 w-3 text-[#d92d20]" /> Comprometido
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-[#0086c9]" /> Endurecido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-[#d97706]/70" /> Objetivo previsto de fase
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span>{nodes.length} activos</span>
          <span className="text-[#b42318]">{positions.filter((p) => compromised.has(p.id)).length} comprometidos</span>
          <span className="text-[#026aa2]">{positions.filter((p) => hardened.has(p.id)).length} endurecidos</span>
        </span>
      </div>

      {/* Panel de detalle del activo seleccionado — datos reales del escenario */}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 overflow-hidden border-t border-[#f2f4f7]"
          >
            <div className="grid gap-4 bg-[#f9fafb] p-4 sm:grid-cols-[1.1fr_1fr_1fr]">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display truncate text-sm font-bold text-[#101828]">{selected.name}</p>
                    <p className="mt-0.5 font-mono-tight text-[10px] text-[#667085]">
                      {selected.id} · {selected.ip} · {SEG_LABEL[selected.segment] ?? selected.segment}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Cerrar detalle"
                    className="rounded p-1 text-[#98a2b3] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="font-mono-tight text-[9.5px] uppercase tracking-wider text-[#98a2b3]">Criticidad</span>
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 w-4 rounded-full',
                          i < selected.criticality ? 'bg-gradient-to-r from-[#fdb022] to-[#f97066]' : 'bg-[#eaecf0]'
                        )}
                      />
                    ))}
                  </span>
                  <span className="font-mono-tight text-[10px] text-[#475467]">{selected.criticality}/5</span>
                </div>
                {(compromised.has(selected.id) || hardened.has(selected.id)) && (
                  <p
                    className={cn(
                      'mt-2.5 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono-tight text-[9.5px] font-bold',
                      compromised.has(selected.id)
                        ? 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]'
                        : 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]'
                    )}
                  >
                    {compromised.has(selected.id) ? <Bug className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {compromised.has(selected.id) ? 'COMPROMETIDO POR RED' : 'ENDURECIDO POR BLUE'}
                  </p>
                )}

                {/* Estado real del laboratorio para este nodo */}
                {labNode && (
                  <div className="mt-2.5 rounded-lg border border-[#e4e7ec] bg-white p-2.5">
                    <p className="flex items-center gap-1.5 font-mono-tight text-[9px] font-bold uppercase tracking-[0.16em] text-[#667085]">
                      <Server className="h-3 w-3" /> Servicio real del lab
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-[#e4e7ec] bg-[#f9fafb] px-1.5 py-px font-mono-tight text-[9px] text-[#475467]">
                        {labNode.compromised ? `${labNode.sessions} sesión(es) RED` : 'sin sesiones RED'}
                      </span>
                      {labNode.isolated && (
                        <span className="flex items-center gap-1 rounded border border-[#fecdca] bg-[#fef3f2] px-1.5 py-px font-mono-tight text-[9px] font-bold text-[#b42318]">
                          <ShieldAlert className="h-2.5 w-2.5" /> AISLADO POR SOC
                        </span>
                      )}
                      {(labNode.vulnerabilities.filter((v) => v.status === 'PATCHED').length > 0) && (
                        <span className="rounded border border-[#a6f4c5] bg-[#ecfdf3] px-1.5 py-px font-mono-tight text-[9px] font-bold text-[#067647]">
                          {labNode.vulnerabilities.filter((v) => v.status === 'PATCHED').length} parche(s) aplicado(s)
                        </span>
                      )}
                    </div>
                    {labLastExchanges.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {labLastExchanges.map((x, i) => (
                          <li key={i} className="flex items-center gap-1.5 font-mono-tight text-[9px] text-[#667085]">
                            <span
                              className={cn(
                                'rounded px-1 font-bold',
                                x.status < 300 ? 'bg-[#ecfdf3] text-[#067647]' : x.status < 400 ? 'bg-[#f0f9ff] text-[#026aa2]' : 'bg-[#fef3f2] text-[#b42318]'
                              )}
                            >
                              {x.status || 'ERR'}
                            </span>
                            <span className="truncate">
                              {x.method} {x.path}
                            </span>
                            {x.signature && <span className="shrink-0 text-[#b42318]">· {x.signature}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#b42318]">
                  <Bug className="h-3 w-3" /> Vulnerabilidades
                </p>
                <ul className="mt-1.5 space-y-1">
                  {selected.vulnerabilities.length > 0 ? (
                    selected.vulnerabilities.map((v) => {
                      const st = labNode?.vulnerabilities.find((x) => x.name === v)?.status
                      return (
                        <li key={v} className="flex items-center gap-1.5 text-[11.5px] leading-snug text-[#344054]">
                          <span>{v}</span>
                          {st === 'PATCHED' && (
                            <span className="shrink-0 rounded border border-[#a6f4c5] bg-[#ecfdf3] px-1 font-mono-tight text-[8.5px] font-bold text-[#067647]">PARCHEADA</span>
                          )}
                        </li>
                      )
                    })
                  ) : (
                    <li className="text-[11.5px] text-[#667085]">Sin vulnerabilidades conocidas.</li>
                  )}
                </ul>
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#026aa2]">
                  <Lock className="h-3 w-3" /> Controles
                </p>
                <ul className="mt-1.5 space-y-1">
                  {selected.controls.length > 0 ? (
                    selected.controls.map((c) => (
                      <li key={c} className="text-[11.5px] leading-snug text-[#344054]">
                        {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-[11.5px] text-[#667085]">Solo controles básicos.</li>
                  )}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* pista cuando no hay selección */}
      {!selected && (
        <div className="relative z-10 flex items-center justify-center gap-1.5 border-t border-[#f2f4f7] px-3.5 py-1.5 text-[10px] text-[#98a2b3]">
          <MousePointerClick className="h-3 w-3" />
          Selecciona un activo del mapa para ver sus vulnerabilidades y controles reales.
        </div>
      )}
    </div>
  )
}
