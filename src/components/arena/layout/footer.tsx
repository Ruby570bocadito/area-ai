'use client'

import { Crosshair, Swords } from 'lucide-react'
import type { StateResponse } from '@/lib/api-types'
import { Wordmark } from './brand'

export function Footer({ state }: { state: StateResponse | null }) {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-black/20">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Wordmark sub={false} />
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <p className="max-w-md text-[11.5px] leading-relaxed text-muted-foreground">
            Laboratorio adversarial de agentes IA. Todo el combate ocurre en un entorno simulado y
            autorizado: las campañas, el conocimiento y la evolución son reales del motor.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
            <Swords className="h-3 w-3 text-[#f4536e]" /> Red
            <span className="text-white/25">vs</span>
            <Crosshair className="h-3 w-3 text-[#41c0ef]" /> Blue
          </span>
          <span className="font-mono-tight text-[10px] text-muted-foreground">
            RED {state?.stats.evolutionRed ?? '—'}% · BLUE {state?.stats.evolutionBlue ?? '—'}% evolución
          </span>
        </div>
      </div>
    </footer>
  )
}
