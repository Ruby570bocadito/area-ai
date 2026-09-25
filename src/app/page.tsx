'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, History, Users, Swords, Radio, Cpu } from 'lucide-react'
import { FaUserSecret, FaShieldHalved } from 'react-icons/fa6'
import { useToast } from '@/hooks/use-toast'
import type { StateResponse } from '@/lib/api-types'
import { Hero } from '@/components/arena/hero'
import { ControlCenter } from '@/components/arena/control-center'
import { ArenaLive } from '@/components/arena/arena-live'
import { KnowledgePanel } from '@/components/arena/knowledge-panel'
import { Roster } from '@/components/arena/roster'
import { HistoryPanel } from '@/components/arena/history-panel'
import { ModelStudio } from '@/components/arena/model-studio'
import { SectionTitle, Reveal } from '@/components/arena/section'

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
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* Barra superior */}
      <nav className="sticky top-0 z-40 border-b border-[#131f38] bg-[#04060d]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#22d3ee]/60 bg-[#04141b]">
              <Swords className="h-4 w-4 text-[#22d3ee]" />
            </span>
            <div className="leading-none">
              <p className="font-display text-sm font-bold tracking-[0.18em] text-foreground">
                AEGIS<span className="text-[#ff3355]">·</span>ARENA
              </p>
              <p className="mt-0.5 hidden font-grotesk text-[9px] uppercase tracking-[0.28em] text-muted-foreground sm:block">
                Cyber Warfare Sandbox
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
            <span className="nav-link hidden font-mono-tight text-[11px] md:inline">
              {state?.stats.totalCampaigns ?? 0} campañas · {state?.stats.knowledgeCount ?? 0} conocimientos
            </span>
            {state && <ModelStudio onSaved={() => void load()} />}
            <span
              className={
                running
                  ? 'flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-1 font-mono-tight text-[10px] font-bold text-amber-300 sm:px-2.5'
                  : 'flex shrink-0 items-center gap-1.5 rounded-full border border-[#1c2b4a] bg-black/40 px-2 py-1 font-mono-tight text-[10px] sm:px-2.5'
              }
            >
              <Radio className="h-3 w-3" />
              <span className="hidden sm:inline">{running ? 'EN DIRECTO' : 'EN ESPERA'}</span>
              {running && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 anim-blink" />}
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {state ? (
          <>
            <Hero stats={state.stats} provider={state.provider} />
            <div className="mx-auto max-w-7xl space-y-14 px-4 pb-16 sm:px-6">
              {/* 01 — Centro de mando */}
              <section aria-label="Centro de mando" id="mando">
                <SectionTitle
                  index="01"
                  title="Centro de Mando"
                  subtitle="Selecciona un escenario empresarial con infraestructura vulnerable y lanza una campaña autónoma Red vs Blue. El motor elige a los agentes de cada fase y el conocimiento acumulado se inyecta en sus decisiones."
                  icon={<Swords className="h-3.5 w-3.5" />}
                />
                <Reveal className="mt-5">
                  <ControlCenter
                    scenarios={state.scenarios}
                    running={running}
                    provider={state.provider}
                    disabled={running}
                    onStart={handleStart}
                  />
                </Reveal>
              </section>

              {/* 02 — Arena en vivo */}
              {state.liveCampaign && (
                <section aria-label="Arena en vivo" id="arena">
                  <SectionTitle
                    index="02"
                    title={running ? 'Arena — Combate en directo' : 'Arena — Última campaña'}
                    subtitle="Telemetría del combate en tiempo real: mapa de red de la infraestructura objetivo, haces de ataque e intrusión, decisiones de cada agente IA y estado de los nodos."
                    icon={<Cpu className="h-3.5 w-3.5" />}
                  />
                  <Reveal className="mt-5">
                    <ArenaLive
                      campaign={state.liveCampaign}
                      events={state.liveEvents}
                      agents={state.agents}
                      infraNodes={state.liveInfra?.nodes ?? []}
                      running={running}
                    />
                  </Reveal>
                </section>
              )}

              {/* 03 — Base de conocimiento */}
              <section aria-label="Base de conocimiento" id="conocimiento">
                <SectionTitle
                  index="03"
                  title="Base de conocimiento en evolución"
                  subtitle="Cada campaña archiva lecciones que se inyectan en las siguientes: cuanto más se usa un conocimiento y mejor funciona, más sube su confianza — el bucle de autoevolución."
                  icon={<BrainCircuit className="h-3.5 w-3.5" />}
                />
                <Reveal className="mt-5">
                  <KnowledgePanel red={state.knowledge.red} blue={state.knowledge.blue} />
                </Reveal>
              </section>

              {/* 04 — Roster */}
              <section aria-label="Agentes" id="agentes">
                <SectionTitle
                  index="04"
                  title="Roster de agentes IA"
                  subtitle="Diez operadores autónomos con especialidad, personalidad y memoria propia: ganan experiencia, suben de nivel y mejoran sus tácticas campaña tras campaña."
                  icon={<Users className="h-3.5 w-3.5" />}
                />
                <Reveal className="mt-5">
                  <Roster agents={state.agents} />
                </Reveal>
              </section>

              {/* 05 — Historial */}
              <section aria-label="Historial de campañas" id="historial">
                <SectionTitle
                  index="05"
                  title="Historial de campañas"
                  subtitle="Archivo completo de enfrentamientos: marcador, duración, escenario y resultado. El historial alimenta las métricas de evolución de ambos equipos."
                  icon={<History className="h-3.5 w-3.5" />}
                />
                <Reveal className="mt-5">
                  <HistoryPanel campaigns={state.campaigns} />
                </Reveal>
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
            <p className="font-grotesk text-sm text-muted-foreground">
              {loadError ? 'Error de conexión — reintentando…' : 'Inicializando AEGIS ARENA…'}
            </p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-[#131f38] bg-black/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[11px] text-muted-foreground sm:px-6">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-foreground/70">
              <FaUserSecret className="text-[#ff3355]/80" /> Red
              <span className="text-muted-foreground/50">vs</span>
              <FaShieldHalved className="text-[#22d3ee]/80" /> Blue
            </span>
            <p className="font-grotesk max-w-md">
              AEGIS ARENA — Sandbox educativo de ciberseguridad con agentes IA. Todo ocurre en un
              entorno simulado y autorizado.
            </p>
          </div>
          <p className="font-mono-tight">
            RED {state?.stats.evolutionRed ?? '—'}% · BLUE {state?.stats.evolutionBlue ?? '—'}% de evolución
          </p>
        </div>
      </footer>
    </div>
  )
}
