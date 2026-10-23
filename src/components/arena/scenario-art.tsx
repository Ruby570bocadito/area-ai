'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// ScenarioArt — ilustración procedural de la red objetivo de un
// escenario (sustituye a las imágenes generadas por IA, decisión
// del propietario 2026-10-23). Dibujo SVG determinista a partir
// del `key` del escenario: malla de nodos con segmentos, un nudo
// central (el activo crítico) y dos haces — el empuje RED desde
// la izquierda y la respuesta BLUE desde la derecha — con el
// mismo lenguaje de color que el resto del producto
// (arena-colors / tokens ink-surface). Nada de arte externo:
// 100 % código, escala sin borrosidad y pesa ~2 KB.
// ─────────────────────────────────────────────────────────────

// PRNG determinista (mulberry32) sembrado con el key del escenario:
// cada escenario conserva SIEMPRE la misma red, sin hidración inestable.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

interface ArtNode {
  x: number
  y: number
  r: number
  core: boolean
}

interface ArtLink {
  a: ArtNode
  b: ArtNode
  opacity: number
}

function buildLayout(seed: string): { nodes: ArtNode[]; links: ArtLink[] } {
  const rnd = seededRandom(seed)
  const nodes: ArtNode[] = []
  const links: ArtLink[] = []

  // Nudo central: el activo crítico del escenario
  const core: ArtNode = { x: 50, y: 50, r: 5.4, core: true }
  nodes.push(core)

  // Malla periférica: 9 nodos repartidos en tres bandas de profundidad,
  // con separación vertical para que no se peguen entre sí.
  const bands = [30, 50, 70]
  let guard = 0
  while (nodes.length < 10 && guard < 80) {
    guard++
    const band = bands[Math.floor(rnd() * bands.length)]
    const x = 14 + rnd() * 72
    const y = band + (rnd() - 0.5) * 9
    if (Math.hypot(x - core.x, y - core.y) < 15) continue
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 13)) continue
    nodes.push({ x, y, r: 2.2 + rnd() * 1.4, core: false })
  }

  // Conexiones: cada nodo se enlaza al vecino más próximo y, con
  // probabilidad, al nudo central (topología de red con troncal).
  for (let i = 1; i < nodes.length; i++) {
    let nearest = core
    let best = Infinity
    for (let j = 1; j < nodes.length; j++) {
      if (i === j) continue
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (d < best && !links.some((l) => l.a === nodes[j] && l.b === nodes[i])) {
        best = d
        nearest = nodes[j]
      }
    }
    links.push({ a: nodes[i], b: nearest, opacity: 0.22 + rnd() * 0.14 })
    if (rnd() > 0.55) links.push({ a: nodes[i], b: core, opacity: 0.3 + rnd() * 0.15 })
  }

  return { nodes, links }
}

export function ScenarioArt({ seed, className }: { seed: string; className?: string }) {
  const { nodes, links } = useMemo(() => buildLayout(seed), [seed])

  // Rutas RED (izquierda → nudo) y BLUE (derecha → nudo): la historia
  // del producto en una imagen, con los colores de equipo reales.
  const redPath = `M -2 ${34 + (seed.length % 7)} C 18 36, 30 44, 46 48.6`
  const bluePath = `M 102 ${64 - (seed.length % 5)} C 82 62, 70 56, 54 51.6`

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn('h-full w-full', className)}
      role="presentation"
    >
      <defs>
        <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0c111d" />
          <stop offset="55%" stopColor="#101828" />
          <stop offset="100%" stopColor="#141d2e" />
        </linearGradient>
        <radialGradient id={`halo-${seed}`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#364152" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0c111d" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#bg-${seed})`} />
      <rect width="100" height="100" fill={`url(#halo-${seed})`} />

      {/* Malla de fondo: cuadrícula técnica muy tenue */}
      <g stroke="#364152" strokeOpacity="0.16" strokeWidth="0.22">
        {[20, 40, 60, 80].map((v) => (
          <line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" />
        ))}
        {[20, 40, 60, 80].map((v) => (
          <line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} />
        ))}
      </g>

      {/* Enlaces de la red */}
      <g stroke="#98a2b3" strokeLinecap="round">
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            strokeOpacity={l.opacity}
            strokeWidth="0.34"
          />
        ))}
      </g>

      {/* Empuje RED (ataque) y respuesta BLUE (defensa) */}
      <g fill="none" strokeLinecap="round">
        <path d={redPath} stroke="#f97066" strokeOpacity="0.75" strokeWidth="0.8" />
        <path d={redPath} stroke="#f97066" strokeOpacity="0.2" strokeWidth="2" />
        <path d={bluePath} stroke="#53b1fd" strokeOpacity="0.75" strokeWidth="0.8" />
        <path d={bluePath} stroke="#53b1fd" strokeOpacity="0.2" strokeWidth="2" />
      </g>

      {/* Nodos */}
      <g>
        {nodes.map((n, i) => (
          <g key={i}>
            {n.core && <circle cx={n.x} cy={n.y} r="9" fill="none" stroke="#7cd4fd" strokeOpacity="0.35" strokeWidth="0.3" />}
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.core ? '#7cd4fd' : '#cbd5e1'} fillOpacity={n.core ? 0.95 : 0.8} />
            {n.core && <circle cx={n.x} cy={n.y} r={n.r * 0.45} fill="#0c111d" />}
          </g>
        ))}
      </g>
    </svg>
  )
}
