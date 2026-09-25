'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import SplitType from 'split-type'
import NumberFlow from '@number-flow/react'
import { FaUserSecret, FaShieldHalved } from 'react-icons/fa6'
import { Radar, Database, Trophy, Flame, ShieldCheck, BrainCircuit } from 'lucide-react'
import { ParticleField } from './particle-field'
import type { StateResponse } from '@/lib/api-types'

function StatTile({
  icon,
  label,
  value,
  tone = 'default',
  suffix,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'default' | 'red' | 'cyan' | 'violet' | 'amber'
  suffix?: string
  delay: number
}) {
  const toneCls = {
    default: 'text-foreground',
    red: 'text-[#ff6b85]',
    cyan: 'text-[#67e8f9]',
    violet: 'text-[#c4a5ff]',
    amber: 'text-amber-300',
  }[tone]
  return (
    <div
      className="glass group relative overflow-hidden rounded-xl px-4 py-3 transition-colors hover:border-[#22d3ee]/30"
      style={{ opacity: 0 }}
      ref={(el) => {
        if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.55, delay, ease: 'power2.out' })
      }}
    >
      <span className="pointer-events-none absolute -right-3 -top-3 text-muted-foreground/10 transition-colors group-hover:text-[#22d3ee]/20">
        {icon}
      </span>
      <p className={`font-display text-2xl font-bold leading-none ${toneCls}`}>
        <NumberFlow value={value} suffix={suffix} />
      </p>
      <p className="mt-1.5 font-grotesk text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

export function Hero({ stats, provider }: { stats: StateResponse['stats']; provider: string }) {
  const rootRef = useRef<HTMLElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  // Reveal profesional del titular: chars con GSAP; al terminar,
  // se revierte el split para que el gradiente shimmer pinte el texto.
  useEffect(() => {
    if (!titleRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const split = new SplitType(titleRef.current, { types: 'chars' })
    // cada char recibe el gradiente recortado para verse durante el vuelo
    split.chars?.forEach((ch) => {
      ch.style.backgroundImage = 'linear-gradient(90deg, #22d3ee, #8b9dff, #ff3355)'
      ch.style.backgroundSize = '200% auto'
      ch.style.webkitBackgroundClip = 'text'
      ch.style.backgroundClip = 'text'
      ch.style.color = 'transparent'
    })
    const ctx = gsap.context(() => {
      gsap.from(split.chars ?? [], {
        opacity: 0,
        y: 42,
        rotateX: -80,
        stagger: 0.045,
        duration: 0.9,
        ease: 'power4.out',
        delay: 0.15,
        onComplete: () => {
          // devolver el h1 a texto plano para restaurar background-clip: text
          split.revert()
        },
      })
    }, rootRef)
    return () => {
      ctx.revert()
      split.revert()
    }
  }, [])

  return (
    <header ref={rootRef} className="relative overflow-hidden">
      <ParticleField />
      <div className="grid-bg absolute inset-0" />
      {/* halos duales red/blue */}
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#ff3355]/10 blur-[110px]" />
      <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-[#22d3ee]/10 blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
        {/* eyebrow */}
        <div className="flex flex-col items-center text-center">
          <span className="glass mb-6 flex items-center gap-2.5 rounded-full px-5 py-2 font-mono-tight text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            <Radar className="h-3.5 w-3.5 text-[#22d3ee]" />
            Autonomous Cyber Warfare Sandbox
            <span className="h-3 w-px bg-white/15" />
            <span className="text-[#67e8f9]">{provider}</span>
          </span>

          <h1
            ref={titleRef}
            className="anim-shimmer font-display text-6xl font-bold leading-[0.95] tracking-tight sm:text-8xl"
          >
            AEGIS ARENA
          </h1>

          <p className="mt-5 max-w-3xl font-grotesk text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
            Agentes autónomos de{' '}
            <span className="font-semibold text-[#ff6b85]">Red Team</span> y{' '}
            <span className="font-semibold text-[#67e8f9]">Blue Team</span> libran campañas continuas sobre
            infraestructuras empresariales simuladas. Cada combate genera conocimiento que se archiva,
            se reutiliza y hace evolucionar a ambos equipos:{' '}
            <span className="text-foreground/85">
              una máquina de guerra cibernética que aprende de sí misma.
            </span>
          </p>

          {/* Emblema VS */}
          <div className="mt-8 flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="conic-ring conic-ring-red flex h-12 w-12 items-center justify-center rounded-full p-[1.5px] sm:h-14 sm:w-14">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#14060c]">
                  <FaUserSecret className="h-5 w-5 text-[#ff4d6d] sm:h-6 sm:w-6" />
                </span>
              </span>
              <div className="text-left">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-[#ff6b85] sm:text-base">
                  Red Team
                </p>
                <p className="font-grotesk text-[10px] uppercase tracking-widest text-muted-foreground">
                  Ofensiva · Intrusión
                </p>
              </div>
            </div>

            <span className="anim-glitch font-display text-2xl font-bold text-foreground/90 sm:text-3xl">
              VS
            </span>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-[#67e8f9] sm:text-base">
                  Blue Team
                </p>
                <p className="font-grotesk text-[10px] uppercase tracking-widest text-muted-foreground">
                  Defensa · Endurecimiento
                </p>
              </div>
              <span className="conic-ring conic-ring-cyan flex h-12 w-12 items-center justify-center rounded-full p-[1.5px] sm:h-14 sm:w-14">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#04141b]">
                  <FaShieldHalved className="h-5 w-5 text-[#22d3ee] sm:h-6 sm:w-6" />
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon={<Flame className="h-8 w-8" />} label="Campañas" value={stats.totalCampaigns} tone="violet" delay={0.35} />
          <StatTile icon={<Trophy className="h-8 w-8" />} label="Victorias RED" value={stats.redWins} tone="red" delay={0.42} />
          <StatTile icon={<ShieldCheck className="h-8 w-8" />} label="Victorias BLUE" value={stats.blueWins} tone="cyan" delay={0.49} />
          <StatTile icon={<Database className="h-8 w-8" />} label="Conocimiento" value={stats.knowledgeCount} delay={0.56} />
          <StatTile icon={<BrainCircuit className="h-8 w-8" />} label="Evolución RED" value={stats.evolutionRed} suffix="%" tone="red" delay={0.63} />
          <StatTile icon={<BrainCircuit className="h-8 w-8" />} label="Evolución BLUE" value={stats.evolutionBlue} suffix="%" tone="cyan" delay={0.7} />
        </div>
      </div>
    </header>
  )
}
