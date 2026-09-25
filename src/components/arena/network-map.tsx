'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Shield, Skull } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventDTO, InfraNodeDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Mapa de red animado: haces de ataque, escudos y estados de nodo
// ─────────────────────────────────────────────────────────────

const COL_X: Record<number, number> = { 0: 82, 1: 295, 2: 510, 3: 700 }
const SEG_COL: Record<string, number> = { DMZ: 1, CORE: 2, AD: 3, OT: 3, CLOUD: 3 }

interface NodePos extends InfraNodeDTO {
  x: number
  y: number
}

export function NetworkMap({
  nodes,
  events,
  running,
}: {
  nodes: InfraNodeDTO[]
  events: EventDTO[]
  running: boolean
}) {
  const positions = useMemo<NodePos[]>(() => {
    const byCol = new Map<number, InfraNodeDTO[]>()
    for (const n of nodes) {
      const col = SEG_COL[n.segment] ?? 3
      const arr = byCol.get(col) ?? []
      arr.push(n)
      byCol.set(col, arr)
    }
    const H = 300
    const out: NodePos[] = []
    for (const [col, arr] of byCol) {
      arr.forEach((n, i) => {
        out.push({
          ...n,
          x: COL_X[col],
          y: 38 + ((i + 1) * (H - 40)) / (arr.length + 1),
        })
      })
    }
    return out
  }, [nodes])

  const byId = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])

  // estados derivados de eventos
  const { compromised, hardened, lastRed, lastBlue } = useMemo(() => {
    const comp = new Set<string>()
    const hard = new Set<string>()
    let lr: EventDTO | null = null
    let lb: EventDTO | null = null
    for (const ev of events) {
      if (ev.team === 'RED') {
        if ((ev.result === 'EXITO' || ev.result === 'PARCIAL') && ev.targetNode) comp.add(ev.targetNode)
        lr = ev
      } else if (ev.team === 'BLUE') {
        if (ev.targetNode) hard.add(ev.targetNode)
        lb = ev
      }
    }
    return { compromised: comp, hardened: hard, lastRed: lr, lastBlue: lb }
  }, [events])

  const RED_BASE = { x: 82, y: 150 }
  const BLUE_BASE = { x: 700, y: 292 }

  const beamPath = (to: NodePos | undefined, from = RED_BASE) => {
    if (!to) return ''
    const mx = (from.x + to.x) / 2
    const my = Math.min(from.y, to.y) - 46
    return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`
  }

  return (
    <div className="scanlines relative overflow-hidden rounded-xl border border-[#1c2b4a] bg-[#050912]/80">
      <div className="grid-bg absolute inset-0" />
      {running && <div className="scan-beam" />}
      <svg viewBox="0 0 800 330" className="relative z-10 h-auto w-full" role="img" aria-label="Mapa de red de la campaña">
        <defs>
          <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff3355" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff3355" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* conexiones estructurales */}
        {positions.map((n) => {
          const col = SEG_COL[n.segment] ?? 3
          const prevX = COL_X[col - 1] ?? COL_X[0]
          return positions
            .filter((p) => {
              const pc = SEG_COL[p.segment] ?? 3
              return pc === (col === 3 ? 2 : col - 1)
            })
            .map((p) => (
              <path
                key={`${n.id}-${p.id}`}
                d={`M ${prevX === COL_X[0] && col === 1 ? RED_BASE.x : p.x} ${
                  prevX === COL_X[0] && col === 1 ? RED_BASE.y : p.y
                } Q ${(p.x + n.x) / 2} ${Math.min(p.y, n.y) - 24} ${n.x} ${n.y}`}
                fill="none"
                stroke="rgba(80,110,170,0.22)"
                strokeWidth="1.2"
              />
            ))
        })}

        {/* haz de ataque RED */}
        {lastRed?.targetNode && byId.get(lastRed.targetNode) && (
          <motion.g key={`red-${lastRed.id}`}>
            <path
              d={beamPath(byId.get(lastRed.targetNode))}
              fill="none"
              stroke="#ff3355"
              strokeWidth="2"
              className="attack-beam"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,51,85,0.8))' }}
            />
          </motion.g>
        )}

        {/* haz defensivo BLUE */}
        {lastBlue?.targetNode && byId.get(lastBlue.targetNode) && (
          <motion.g key={`blue-${lastBlue.id}`}>
            <path
              d={beamPath(byId.get(lastBlue.targetNode), BLUE_BASE)}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              className="attack-beam"
              style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.8))' }}
            />
          </motion.g>
        )}

        {/* base RED */}
        <g>
          <circle cx={RED_BASE.x} cy={RED_BASE.y} r="42" fill="url(#redGlow)" />
          <circle cx={RED_BASE.x} cy={RED_BASE.y} r="17" fill="#14060c" stroke="#ff3355" strokeWidth="2" className={running ? 'svg-pulse-red' : ''} />
          <text x={RED_BASE.x} y={RED_BASE.y + 4} textAnchor="middle" fontSize="11" fill="#ff6b85" fontWeight="bold">
            R
          </text>
          <text x={RED_BASE.x} y={RED_BASE.y + 52} textAnchor="middle" fontSize="9" fill="#ff8299" fontFamily="monospace">
            RED ORIGIN
          </text>
        </g>

        {/* base BLUE */}
        <g>
          <circle cx={BLUE_BASE.x} cy={BLUE_BASE.y} r="42" fill="url(#cyanGlow)" />
          <circle cx={BLUE_BASE.x} cy={BLUE_BASE.y} r="17" fill="#04141b" stroke="#22d3ee" strokeWidth="2" />
          <text x={BLUE_BASE.x} y={BLUE_BASE.y + 4} textAnchor="middle" fontSize="11" fill="#67e8f9" fontWeight="bold">
            B
          </text>
          <text x={BLUE_BASE.x} y={BLUE_BASE.y + 34} textAnchor="middle" fontSize="9" fill="#7ee7f9" fontFamily="monospace">
            SOC
          </text>
        </g>

        {/* nodos de infraestructura */}
        {positions.map((n) => {
          const isComp = compromised.has(n.id)
          const isHard = hardened.has(n.id)
          const isTargetRed = lastRed?.targetNode === n.id && lastRed?.team === 'RED'
          const isTargetBlue = lastBlue?.targetNode === n.id && lastBlue?.team === 'BLUE'
          const r = 13 + n.criticality
          return (
            <g key={n.id}>
              {(isTargetRed || isTargetBlue) && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 6}
                  fill="none"
                  stroke={isTargetRed ? '#ff3355' : '#22d3ee'}
                  strokeWidth="1.5"
                  className="svg-pulse-red"
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={isComp ? '#1a0a12' : isHard ? '#04141b' : '#0a101f'}
                stroke={isComp ? '#ff3355' : isHard ? '#22d3ee' : '#3b5486'}
                strokeWidth={isComp || isHard ? 2 : 1.2}
                style={{
                  filter:
                    isComp
                      ? 'drop-shadow(0 0 8px rgba(255,51,85,0.65))'
                      : isHard
                        ? 'drop-shadow(0 0 8px rgba(34,211,238,0.6))'
                        : undefined,
                }}
              />
              <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize="8.5" fill={isComp ? '#ff8299' : isHard ? '#7ee7f9' : '#9fb0cc'} fontFamily="monospace" fontWeight="bold">
                {n.type.slice(0, 6)}
              </text>
              <text x={n.x} y={n.y + r + 13} textAnchor="middle" fontSize="9" fill="#c3d0e4" fontFamily="monospace">
                {n.name.length > 22 ? n.name.slice(0, 21) + '…' : n.name}
              </text>
              <text x={n.x} y={n.y - r - 6} textAnchor="middle" fontSize="8" fill="#7e8ba6" fontFamily="monospace">
                {n.ip}
              </text>
            </g>
          )
        })}
      </svg>

      {/* leyenda */}
      <div className="relative z-10 flex flex-wrap items-center gap-3 border-t border-[#1c2b4a] px-3 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Skull className="h-3 w-3 text-[#ff3355]" /> Ataque en curso
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-[#22d3ee]" /> Defensa activa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-[#ff3355] bg-[#1a0a12]" /> Comprometido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-[#22d3ee] bg-[#04141b]" /> Endurecido
        </span>
        <span className="ml-auto font-mono-tight">
          {nodes.length} activos · {positions.filter((n) => compromised.has(n.id)).length} comprometidos
        </span>
      </div>
    </div>
  )
}
