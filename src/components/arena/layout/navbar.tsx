'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Radio, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StateResponse } from '@/lib/api-types'
import { CommandPalette } from '@/components/arena/command-palette'
import { ModelStudio } from '@/components/arena/model-studio'
import { BrandMark, Wordmark } from './brand'

export const NAV_LINKS = [
  { href: '#mando', label: 'Escenarios' },
  { href: '#arena', label: 'Arena' },
  { href: '#conocimiento', label: 'Conocimiento' },
  { href: '#agentes', label: 'Agentes' },
  { href: '#historial', label: 'Historial' },
  { href: '#analitica', label: 'Analítica' },
] as const

export function Navbar({
  state,
  running,
  onStart,
  onProviderSaved,
}: {
  state: StateResponse | null
  running: boolean
  onStart: (scenarioId?: string) => void
  onProviderSaved: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08090d]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <BrandMark />
          <Wordmark />
        </a>

        {/* Enlaces de escritorio */}
        <div className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link font-mono-tight text-[11px] uppercase tracking-[0.14em]">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {state && <CommandPalette scenarios={state.scenarios} running={running} onStart={onStart} />}
          <span className="nav-link hidden font-mono-tight text-[11px] xl:inline">
            {state?.stats.totalCampaigns ?? 0} campañas · {state?.stats.knowledgeCount ?? 0} conocimientos
          </span>
          {state && <ModelStudio onSaved={onProviderSaved} />}
          <span
            className={cn(
              running
                ? 'status-live flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tight text-[10px] font-bold sm:px-3'
                : 'flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono-tight text-[10px] text-muted-foreground sm:px-3'
            )}
          >
            <Radio className="h-3 w-3" />
            <span className="hidden sm:inline">{running ? 'EN DIRECTO' : 'EN ESPERA'}</span>
            {running && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#e8b64c]" />}
          </span>
          {/* Menú móvil */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-foreground/80 transition-colors hover:border-white/25 lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Panel móvil */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.06] lg:hidden"
          >
            <div className="grid gap-0.5 px-4 py-3">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 font-mono-tight text-[12px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
