'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, History, Radio, Users, Swords } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { StateResponse } from '@/lib/api-types'
import { Hero } from '@/components/arena/hero'
import { ControlCenter } from '@/components/arena/control-center'
import { ArenaLive } from '@/components/arena/arena-live'
import { KnowledgePanel } from '@/components/arena/knowledge-panel'
import { Roster } from '@/components/arena/roster'
import { HistoryPanel } from '@/components/arena/history-panel'

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.h2
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center gap-2.5 font-mono-tight text-lg font-bold tracking-wide"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1c2b4a] bg-black/40 text-[#22d3ee]">
        {icon}
      </span>
      {children}
      <span className="ml-1 h-px flex-1 bg-gradient-to-r from-[#22d3ee]/40 to-transparent" />
    </motion.h2>
  )
}

export default function Home() {
  const [state, setState] = useState<StateResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const { toast } = useToast()
  const stateRef = useRef<StateResponse | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' })
      const data = (await res.json()) as StateResponse
      if (data.ok) {
        setState(data)
        stateRef.current = data
        setLoadError(false)
      }
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Polling adaptativo: rápido en campaña en vivo, lento en reposo
  useEffect(() => {
    const running = state?.activeCampaign != null
    const id = setInterval(() => void load(), running ? 2000 : 6000)
    return () => clearInterval(id)
  }, [state?.activeCampaign, load])

  const handleStart = useCallback(
    async (scenarioId?: string) => {
      try {
        const res = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioId }),
        })
        const data = (await res.json()) as { ok: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al iniciar la campaña')
        toast({
          title: '⚔️ Campaña iniciada',
          description: 'Los agentes IA están entrando en combate. Sigue la acción en la arena.',
        })
        await load()
      } catch (e) {
        toast({
          title: 'No se pudo iniciar la campaña',
          description: e instanceof Error ? e.message : 'Error desconocido',
          variant: 'destructive',
        })
      }
    },
    [load, toast]
  )

  const running = state?.activeCampaign != null

  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra superior */}
      <nav className="sticky top-0 z-40 border-b border-[#131f38] bg-[#04060d]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#22d3ee]/60 bg-[#04141b]">
              <Swords className="h-4 w-4 text-[#22d3ee]" />
            </span>
            <span className="font-mono-tight text-sm font-black tracking-[0.2em] text-foreground">
              AEGIS<span className="text-[#ff5f7a]">·</span>ARENA
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="hidden font-mono-tight sm:inline">
              {state?.stats.totalCampaigns ?? 0} campañas · {state?.stats.knowledgeCount ?? 0} conocimientos
            </span>
            <span
              className={
                running
                  ? 'flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 font-mono-tight text-[10px] font-bold text-amber-300'
                  : 'flex items-center gap-1.5 rounded-full border border-[#1c2b4a] bg-black/40 px-2.5 py-1 font-mono-tight text-[10px]'
              }
            >
              <Radio className="h-3 w-3" />
              {running ? 'EN DIRECTO' : 'EN ESPERA'}
              {running && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 anim-blink" />}
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {state ? (
          <>
            <Hero stats={state.stats} provider={state.provider} />
            <div className="mx-auto max-w-7xl space-y-10 px-4 pb-16 sm:px-6">
              <ControlCenter
                scenarios={state.scenarios}
                running={running}
                provider={state.provider}
                disabled={running}
                onStart={handleStart}
              />

              {state.liveCampaign && (
                <section aria-label="Arena en vivo">
                  <SectionTitle icon={<Swords className="h-4 w-4" />}>
                    {running ? 'Arena — Combate en directo' : 'Arena — Última campaña'}
                  </SectionTitle>
                  <div className="mt-4">
                    <ArenaLive
                      campaign={state.liveCampaign}
                      events={state.liveEvents}
                      agents={state.agents}
                      infraNodes={state.liveInfra?.nodes ?? []}
                      running={running}
                    />
                  </div>
                </section>
              )}

              <section aria-label="Base de conocimiento">
                <SectionTitle icon={<BrainCircuit className="h-4 w-4" />}>
                  Base de conocimiento en evolución
                </SectionTitle>
                <p className="mt-1 mb-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Cada campaña archiva lecciones que se inyectan en las siguientes: cuanto más se usa un
                  conocimiento y mejor funciona, más sube su confianza — el bucle de autoevolución.
                </p>
                <KnowledgePanel red={state.knowledge.red} blue={state.knowledge.blue} />
              </section>

              <section aria-label="Agentes">
                <SectionTitle icon={<Users className="h-4 w-4" />}>Roster de agentes IA</SectionTitle>
                <div className="mt-4">
                  <Roster agents={state.agents} />
                </div>
              </section>

              <section aria-label="Historial de campañas">
                <SectionTitle icon={<History className="h-4 w-4" />}>Historial de campañas</SectionTitle>
                <div className="mt-4">
                  <HistoryPanel campaigns={state.campaigns} />
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[#22d3ee]/50"
            >
              <Swords className="h-6 w-6 text-[#22d3ee]" />
            </motion.div>
            <p className="font-mono-tight text-sm text-muted-foreground">
              {loadError ? 'Error de conexión — reintentando…' : 'Inicializando AEGIS ARENA…'}
            </p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-[#131f38] bg-black/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-[11px] text-muted-foreground sm:px-6">
          <p>
            AEGIS ARENA — Sandbox educativo de ciberseguridad con agentes IA. Todo ocurre en un entorno
            simulado y autorizado.
          </p>
          <p className="font-mono-tight">
            RED {state?.stats.evolutionRed ?? '—'}% · BLUE {state?.stats.evolutionBlue ?? '—'}% de evolución
          </p>
        </div>
      </footer>
    </div>
  )
}
