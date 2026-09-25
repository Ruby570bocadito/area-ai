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
// Envuelve cualquier bloque y lo anima al entrar en viewport.
// ─────────────────────────────────────────────────────────────
export function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
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
// Título de sección profesional numerado
// «01 // CENTRO DE MANDO» con línea y descripción opcional
// ─────────────────────────────────────────────────────────────
export function SectionTitle({
  index,
  title,
  subtitle,
  icon,
  className,
}: {
  index: string // ej: "01"
  title: string
  subtitle?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <Reveal className={className}>
      <div className="flex items-end gap-4">
        <span aria-hidden className="section-index text-4xl font-bold sm:text-5xl">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#1c2b4a] bg-black/40 text-[#22d3ee]">
                {icon}
              </span>
            )}
            <h2 className="font-display truncate text-xl font-bold uppercase tracking-[0.08em] text-foreground sm:text-2xl">
              {title}
            </h2>
            <span className="ml-1 hidden h-px flex-1 bg-gradient-to-r from-[#22d3ee]/45 via-[#ff3355]/25 to-transparent sm:block" />
          </div>
          {subtitle && (
            <p className="mt-1 max-w-3xl font-grotesk text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Reveal>
  )
}
