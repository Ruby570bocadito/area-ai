'use client'

import { useEffect, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Swords, Map, Radio, BrainCircuit, Users, History, BarChart3, Settings2, ArrowUpRight } from 'lucide-react'
import type { ScenarioDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Command palette (⌘K) — navegación y acciones rápidas
// ─────────────────────────────────────────────────────────────
export function CommandPalette({
  scenarios,
  running,
  onStart,
}: {
  scenarios: ScenarioDTO[]
  running: boolean
  onStart: (scenarioId?: string) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('area-ai:close-palette', close)
    return () => window.removeEventListener('area-ai:close-palette', close)
  }, [open])

  const go = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const launch = (scenarioId?: string) => {
    setOpen(false)
    onStart(scenarioId)
  }

  const openStudio = () => {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('area-ai:open-model-studio'))
  }

  return (
    <>
      {/* Botón + hint visual en navbar se gestiona desde page.tsx; esto abre por clic */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir paleta de comandos"
        className="nav-link hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono-tight text-[10px] text-muted-foreground transition-colors hover:text-foreground md:flex"
      >
        <span className="text-[11px]">⌘</span>K
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar acciones: lanzar campaña, ir a sección…" />
        <CommandList className="nice-scroll">
          <CommandEmpty>Sin resultados.</CommandEmpty>

          <CommandGroup heading="Campañas">
            {scenarios.map((s) => (
              <CommandItem
                key={s.id}
                value={`lanzar ${s.codename} ${s.company} ${s.industry}`}
                disabled={running}
                onSelect={() => launch(s.id)}
                className="gap-2.5"
              >
                <Swords className="h-3.5 w-3.5 text-[#f4536e]" />
                <span className="flex-1">
                  Lanzar <b>{s.codename}</b>
                  <span className="ml-1.5 text-muted-foreground">· {s.company}</span>
                </span>
                <span className="font-mono-tight text-[9px] text-muted-foreground">dif {s.difficulty}/5</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Navegación">
            {[
              { id: 'mando', label: 'Centro de mando', icon: Map },
              { id: 'arena', label: 'Arena en vivo', icon: Radio },
              { id: 'conocimiento', label: 'Base de conocimiento', icon: BrainCircuit },
              { id: 'agentes', label: 'Roster de agentes', icon: Users },
              { id: 'historial', label: 'Historial', icon: History },
              { id: 'analitica', label: 'Analítica', icon: BarChart3 },
            ].map((s) => (
              <CommandItem key={s.id} value={`ir a ${s.label}`} onSelect={() => go(s.id)} className="gap-2.5">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1">{s.label}</span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Sistema">
            <CommandItem value="model studio configurar modelo motor" onSelect={openStudio} className="gap-2.5">
              <Settings2 className="h-3.5 w-3.5 text-[#e8b64c]" />
              <span className="flex-1">Abrir Model Studio</span>
              <span className="font-mono-tight text-[9px] text-muted-foreground">motor LLM</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
