'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@/lib/utils'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// ─────────────────────────────────────────────────────────────
// Reveal on scroll — GSAP ScrollTrigger (repositorio oficial)
// ─────────────────────────────────────────────────────────────
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  duration = 0.7,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  duration?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { opacity: 1, y: 0 })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }
      )
    }, el)
    return () => ctx.revert()
  }, [delay, y, duration])

  return (
    <div ref={ref} className={cn('gsap-reveal', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Cabecera de sección premium: kicker mono + titular Sora
// ─────────────────────────────────────────────────────────────
export function SectionTitle({
  index,
  kicker,
  title,
  subtitle,
  className,
}: {
  index: string // ej: "01"
  kicker?: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <Reveal className={className}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <span className="font-mono-tight text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              {index}
            </span>
            <span className="h-px w-8 bg-white/20" />
            {kicker && (
              <span className="font-mono-tight text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground/70">
                {kicker}
              </span>
            )}
          </div>
          <h2 className="font-display mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="section-index hidden shrink-0 text-6xl font-bold sm:block"
        >
          {index}
        </span>
      </div>
      <div className="divider-grad mt-6 opacity-60" />
    </Reveal>
  )
}
