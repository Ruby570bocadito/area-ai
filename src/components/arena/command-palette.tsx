'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Swords, Radio, BrainCircuit, Users, History, BarChart3, SlidersHorizontal, LayoutDashboard, ArrowUpRight } from 'lucide-react'
import { useArena } from './shell/arena-provider'

// ─────────────────────────────────────────────────────────────
// Command palette (⌘K) — navegación por rutas y acciones
// rápidas del laboratorio. Montada una sola vez en el AppShell.
// ─────────────────────────────────────────────────────────────

const ROUTES = [
  { href: '/', label: 'Command deck', icon: LayoutDashboard },
  { href: '/arena', label: 'Live operations', icon: Radio },
  { href: '/agentes', label: 'Agent roster', icon: Users },
  { href: '/conocimiento', label: 'Knowledge base', icon: BrainCircuit },
  { href: '/historial', label: 'Campaign history', icon: History },
  { href: '/analitica', label: 'Laboratory analytics', icon: BarChart3 },
  { href: '/modelos', label: 'Model Studio · LLM engine', icon: SlidersHorizontal },
] as const

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { state, running, handleStart } = useArena()

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

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const launch = (scenarioId?: string) => {
    setOpen(false)
    void handleStart(scenarioId)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="hidden items-center gap-1.5 rounded-md border border-surface-200 bg-white px-2.5 py-1.5 font-mono-tight text-[10px] text-ink-500 shadow-sm transition-colors hover:border-surface-300 hover:text-ink-900 md:flex"
        title="Command palette (⌘K)"
      >
        <span className="text-[11px]">⌘</span>K
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search actions: launch a campaign, go to a page…" />
        <CommandList className="nice-scroll">
          <CommandEmpty>No results.</CommandEmpty>

          <CommandGroup heading="Campaigns">
            {(state?.scenarios ?? []).map((s) => (
              <CommandItem
                key={s.id}
                value={`launch ${s.codename} ${s.company} ${s.industry}`}
                disabled={running}
                onSelect={() => launch(s.id)}
                className="gap-2.5"
              >
                <Swords className="h-3.5 w-3.5 text-[#d92d20]" />
                <span className="flex-1">
                  Launch <b>{s.codename}</b>
                  <span className="ml-1.5 text-ink-500">· {s.company}</span>
                </span>
                <span className="font-mono-tight text-[9px] text-ink-500">diff {s.difficulty}/5</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Navigation">
            {ROUTES.map((s) => (
              <CommandItem key={s.href} value={`go to ${s.label}`} onSelect={() => go(s.href)} className="gap-2.5">
                <s.icon className="h-3.5 w-3.5 text-ink-500" />
                <span className="flex-1">{s.label}</span>
                <ArrowUpRight className="h-3 w-3 text-ink-400" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
