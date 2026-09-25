'use client'

import { Crosshair, Swords } from 'lucide-react'
import { useArena } from '@/components/arena/shell/arena-provider'
import { Wordmark } from './brand'

export function Footer() {
  const { state } = useArena()
  return (
    <footer className="mt-auto border-t border-[#e4e7ec] bg-white">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Wordmark sub={false} />
          <span className="hidden h-4 w-px bg-[#e4e7ec] sm:block" />
          <p className="max-w-lg text-[11.5px] leading-relaxed text-[#667085]">
            Laboratorio adversarial de agentes IA. Todo el combate ocurre en un entorno simulado y
            autorizado: las campañas, el conocimiento y la evolución son reales del motor.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono-tight text-[10px] uppercase tracking-wider text-[#667085]">
            <Swords className="h-3 w-3 text-[#d92d20]" /> Red
            <span className="text-[#d0d5dd]">vs</span>
            <Crosshair className="h-3 w-3 text-[#0086c9]" /> Blue
          </span>
          <span className="font-mono-tight text-[10px] text-[#667085]">
            RED {state?.stats.evolutionRed ?? '—'}% · BLUE {state?.stats.evolutionBlue ?? '—'}% evolución
          </span>
        </div>
      </div>
    </footer>
  )
}
