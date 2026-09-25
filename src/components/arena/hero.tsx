'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import SplitType from 'split-type'
import NumberFlow from '@number-flow/react'
import { FaUserSecret, FaShieldHalved } from 'react-icons/fa6'
import { ArrowDown, CircleDot } from 'lucide-react'
import { ParticleField } from './particle-field'
import type { StateResponse } from '@/lib/api-types'

function StatCell({
  label,
  value,
  tone = 'default',
  suffix,
}: {
  label: string
  value: number
  tone?: 'default' | 'red' | 'blue' | 'violet'
  suffix?: string
}) {
  const toneCls = {
    default: 'text-foreground',
    red: 'text-[#f98ca0]',
    blue: 'text-[#8adcf7]',
    violet: 'text-[#c4b0f5]',
  }[tone]
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-4 sm:py-5">
      <p className={`font-display text-xl font-bold leading-none sm:text-2xl ${toneCls}`}>
        <NumberFlow value={value} suffix={suffix} />
      </p>
      <p className="font-mono-tight text-center text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
        {label}
      </p>
    </div>
  )
}

export function Hero({ stats, provider }: { stats: StateResponse['stats']; provider: string }) {
  const rootRef = useRef<HTMLElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const haloRedRef = useRef<HTMLDivElement | null>(null)
  const haloBlueRef = useRef<HTMLDivElement | null>(null)
  const particlesRef = useRef<HTMLDivElement | null>(null)
  const emblemRef = useRef<HTMLDivElement | null>(null)

  // Parallax de profundidad con el ratón (lerp suave, rAF).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return

    let tx = 0, ty = 0, x = 0, y = 0, raf = 0
    const onMove = (e: MouseEvent) => {
      const r = root.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const tick = () => {
      x += (tx - x) * 0.06
      y += (ty - y) * 0.06
      if (haloRedRef.current)
        haloRedRef.current.style.transform = `translate3d(${x * 26}px, ${y * 18}px, 0)`
      if (haloBlueRef.current)
        haloBlueRef.current.style.transform = `translate3d(${x * -26}px, ${y * -18}px, 0)`
      if (particlesRef.current)
        particlesRef.current.style.transform = `translate3d(${x * 10}px, ${y * 8}px, 0)`
      if (emblemRef.current)
        emblemRef.current.style.transform = `translate3d(${x * -9}px, ${y * -6}px, 0)`
      if (Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
      }
    }
    root.addEventListener('mousemove', onMove, { passive: true })
    root.addEventListener('mouseleave', onLeave, { passive: true })
    return () => {
      root.removeEventListener('mousemove', onMove)
      root.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Reveal del titular carácter a carácter (GSAP + SplitType).
  // El punto medio «·» vuela con el gradiente rojo→cian de la marca;
  // al terminar se revierte el split para restaurar el DOM original.
  useEffect(() => {
    if (!titleRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const split = new SplitType(titleRef.current, { types: 'chars' })
    split.chars?.forEach((ch) => {
      if (ch.textContent === '·') {
        ch.style.backgroundImage = 'linear-gradient(90deg, #f4536e, #41c0ef)'
        ch.style.webkitBackgroundClip = 'text'
        ch.style.backgroundClip = 'text'
        ch.style.color = 'transparent'
      }
    })
    const ctx = gsap.context(() => {
      gsap.from(split.chars ?? [], {
        opacity: 0,
        y: 36,
        rotateX: -60,
        stagger: 0.05,
        duration: 0.85,
        ease: 'power4.out',
        delay: 0.15,
        onComplete: () => split.revert(),
      })
    }, rootRef)
    return () => {
      ctx.revert()
      split.revert()
    }
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header ref={rootRef} className="relative overflow-hidden">
      <div ref={particlesRef} className="absolute inset-0 will-change-transform">
        <ParticleField />
      </div>
      <div className="grid-bg absolute inset-0" />
      {/* halos duales, muy tenues — con parallax */}
      <div
        ref={haloRedRef}
        className="pointer-events-none absolute -left-40 top-16 h-[420px] w-[420px] rounded-full bg-[#f4536e]/[0.07] blur-[120px] will-change-transform"
      />
      <div
        ref={haloBlueRef}
        className="pointer-events-none absolute -right-40 top-24 h-[420px] w-[420px] rounded-full bg-[#41c0ef]/[0.06] blur-[120px] will-change-transform"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
        <div className="flex flex-col items-center text-center">
          {/* eyebrow */}
          <div
            className="mb-7 flex items-center gap-2.5"
            style={{ opacity: 0 }}
            ref={(el) => {
              if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.6, delay: 0.05, ease: 'power2.out' })
            }}
          >
            <span className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-mono-tight text-[10px] uppercase tracking-[0.3em] text-muted-foreground backdrop-blur-sm">
              <CircleDot className="h-3 w-3 text-[#41c0ef]" />
              Simulador adversarial autónomo
              <span className="h-3 w-px bg-white/15" />
              <span className="text-foreground/80">{provider}</span>
            </span>
          </div>

          {/* marca */}
          <div className="relative">
            <span className="title-sheen" aria-hidden />
            <h1
              ref={titleRef}
              className="font-display bg-gradient-to-b from-white via-white to-white/45 bg-clip-text text-7xl font-extrabold leading-[0.95] tracking-[-0.03em] text-transparent sm:text-[120px]"
            >
              area<span className="bg-gradient-to-r from-[#f4536e] to-[#41c0ef] bg-clip-text text-transparent">·</span>ai
            </h1>
          </div>

          <p
            className="mt-6 max-w-2xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-base"
            style={{ opacity: 0 }}
            ref={(el) => {
              if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay: 0.55, ease: 'power2.out' })
            }}
          >
            Agentes de IA de{' '}
            <span className="font-semibold text-[#f98ca0]">Red Team</span> y{' '}
            <span className="font-semibold text-[#8adcf7]">Blue Team</span> libran campañas continuas
            sobre infraestructura empresarial simulada. Cada combate genera conocimiento que se
            archiva, se reutiliza y hace evolucionar a ambos equipos.
          </p>

          {/* CTAs */}
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
            style={{ opacity: 0 }}
            ref={(el) => {
              if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay: 0.7, ease: 'power2.out' })
            }}
          >
            <button
              type="button"
              onClick={() => scrollTo('mando')}
              className="flex h-11 items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-[#0a0b0f] transition-all hover:bg-white/90 hover:shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)]"
            >
              Lanzar campaña
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo('agentes')}
              className="flex h-11 items-center rounded-lg border border-white/12 bg-white/[0.03] px-6 text-sm font-medium text-foreground/85 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
            >
              Conocer a los agentes
            </button>
          </div>

          {/* Emblema VS — con parallax inverso */}
          <div
            className="mt-12 flex items-center gap-5 will-change-transform sm:gap-8"
            style={{ opacity: 0 }}
            ref={(el) => {
              emblemRef.current = el
              if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay: 0.85, ease: 'power2.out' })
            }}
          >
            <div className="flex items-center gap-3.5">
              <span className="conic-ring conic-ring-red flex h-12 w-12 items-center justify-center rounded-full p-[1.5px] sm:h-14 sm:w-14">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#16090f]">
                  <FaUserSecret className="h-5 w-5 text-[#f4536e] sm:h-6 sm:w-6" />
                </span>
              </span>
              <div className="text-left">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-[#f98ca0] sm:text-base">
                  Red Team
                </p>
                <p className="font-mono-tight text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Ofensiva · Intrusión
                </p>
              </div>
            </div>

            <span className="font-display text-xl font-bold text-foreground/70 sm:text-2xl">VS</span>

            <div className="flex items-center gap-3.5">
              <div className="text-right">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-[#8adcf7] sm:text-base">
                  Blue Team
                </p>
                <p className="font-mono-tight text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Defensa · Contención
                </p>
              </div>
              <span className="conic-ring conic-ring-blue flex h-12 w-12 items-center justify-center rounded-full p-[1.5px] sm:h-14 sm:w-14">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#081521]">
                  <FaShieldHalved className="h-5 w-5 text-[#41c0ef] sm:h-6 sm:w-6" />
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Franja de estadísticas */}
        <div
          className="mx-auto mt-12 max-w-4xl"
          style={{ opacity: 0 }}
          ref={(el) => {
            if (el) gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay: 1, ease: 'power2.out' })
          }}
        >
          <div className="panel grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6">
            <div className="border-b border-r border-white/[0.06] lg:border-b-0">
              <StatCell label="Campañas" value={stats.totalCampaigns} tone="violet" />
            </div>
            <div className="border-b border-white/[0.06] sm:border-r lg:border-b-0">
              <StatCell label="Victorias RED" value={stats.redWins} tone="red" />
            </div>
            <div className="border-b border-r border-white/[0.06] sm:border-b-0">
              <StatCell label="Victorias BLUE" value={stats.blueWins} tone="blue" />
            </div>
            <div className="border-b border-white/[0.06] sm:border-b-0">
              <StatCell label="Conocimientos" value={stats.knowledgeCount} />
            </div>
            <div className="border-r border-white/[0.06] max-lg:border-b">
              <StatCell label="Evolución RED" value={stats.evolutionRed} suffix="%" tone="red" />
            </div>
            <div className="max-lg:border-b max-lg:border-white/[0.06] lg:border-b-0">
              <StatCell label="Evolución BLUE" value={stats.evolutionBlue} suffix="%" tone="blue" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
