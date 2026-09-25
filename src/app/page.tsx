'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Radio, Swords, Crosshair } from 'lucide-react'
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
import { ScrollProgress, CursorGlow } from '@/components/arena/chrome'

const NAV_LINKS = [
  { href: '#mando', label: 'Escenarios' },
  { href: '#arena', label: 'Arena' },
  { href: '#conocimiento', label: 'Conocimiento' },
  { href: '#agentes', label: 'Agentes' },
  { href: '#historial', label: 'Historial' },
]

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
        setTimeout(() => {
          document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 600)
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
      {/* Capas globales de ambiente */}
      <ScrollProgress />
      <CursorGlow />
      <div className="noise-overlay" aria-hidden />

      {/* Barra superior */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08090d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#" className="flex items-center gap-3">
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-white/[0.04]">
              <span className="absolute inset-0 bg-gradient-to-br from-[#f4536e]/50 via-transparent to-[#41c0ef]/50" />
              <span className="font-display relative text-[13px] font-extrabold text-white">a</span>
            </span>
            <span className="leading-none">
              <span className="font-display block text-[15px] font-extrabold tracking-tight text-foreground">
                area<span className="bg-gradient-to-r from-[#f4536e] to-[#41c0ef] bg-clip-text text-transparent">·</span>ai
              </span>
              <span className="mt-0.5 hidden font-mono-tight text-[8.5px] uppercase tracking-[0.3em] text-muted-foreground sm:block">
                Adversarial Lab
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="nav-link font-mono-tight text-[11px] uppercase tracking-[0.14em]">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="nav-link hidden font-mono-tight text-[11px] xl:inline">
              {state?.stats.totalCampaigns ?? 0} campañas · {state?.stats.knowledgeCount ?? 0} conocimientos
            </span>
            {state && <ModelStudio onSaved={() => void load()} />}
            <span
              className={
                running
                  ? 'status-live flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tight text-[10px] font-bold sm:px-3'
                  : 'flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono-tight text-[10px] text-muted-foreground sm:px-3'
              }
            >
              <Radio className="h-3 w-3" />
              <span className="hidden sm:inline">{running ? 'EN DIRECTO' : 'EN ESPERA'}</span>
              {running && <span className="h-1.5 w-1.5 rounded-full bg-[#e8b64c] anim-blink" />}
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {state ? (
          <>
            <Hero stats={state.stats} provider={state.provider} />
            <div className="mx-auto max-w-7xl space-y-16 px-4 pb-20 sm:px-6">
              {/* 01 — Escenarios */}
              <section aria-label="Centro de mando" id="mando" className="scroll-mt-20">
                <SectionTitle
                  index="01"
                  kicker="Centro de mando"
                  title="Elige el campo de batalla"
                  subtitle="Selecciona un escenario empresarial con infraestructura vulnerable y lanza una campaña autónoma Red vs Blue. El motor asigna agentes a cada fase y les inyecta todo el conocimiento acumulado para que decidan mejor que en la campaña anterior."
                />
                <Reveal className="mt-6">
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
                <section aria-label="Arena en vivo" id="arena" className="scroll-mt-20">
                  <SectionTitle
                    index="02"
                    kicker="Telemetría"
                    title={running ? 'Combate en directo' : 'Última campaña'}
                    subtitle="Mapa de red de la infraestructura objetivo, haces de ataque e intrusión en tiempo real, decisiones de cada agente IA y estado de los nodos comprometidos o endurecidos."
                  />
                  <Reveal className="mt-6">
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
              <section aria-label="Base de conocimiento" id="conocimiento" className="scroll-mt-20">
                <SectionTitle
                  index="03"
                  kicker="Memoria del sistema"
                  title="Conocimiento en evolución"
                  subtitle="Cada campaña archiva lecciones que se inyectan en las siguientes: cuanto más se usa un conocimiento y mejor funciona, más sube su confianza. Ese es el bucle de autoevolución de area·ai."
                />
                <Reveal className="mt-6">
                  <KnowledgePanel red={state.knowledge.red} blue={state.knowledge.blue} />
                </Reveal>
              </section>

              {/* 04 — Roster */}
              <section aria-label="Agentes" id="agentes" className="scroll-mt-20">
                <SectionTitle
                  index="04"
                  kicker="Operadores"
                  title="Roster de agentes IA"
                  subtitle="Diez operadores autónomos con especialidad, personalidad y memoria propia: ganan experiencia, suben de nivel y refinan sus tácticas campaña tras campaña."
                />
                <Reveal className="mt-6">
                  <Roster agents={state.agents} />
                </Reveal>
              </section>

              {/* 05 — Historial */}
              <section aria-label="Historial de campañas" id="historial" className="scroll-mt-20">
                <SectionTitle
                  index="05"
                  kicker="Archivo"
                  title="Historial de campañas"
                  subtitle="Archivo completo de enfrentamientos: marcador, duración, escenario y resultado. Cada registro alimenta las métricas de evolución de ambos equipos."
                />
                <Reveal className="mt-6">
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
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/12"
            >
              <Swords className="h-6 w-6 text-foreground/70" />
            </motion.div>
            <p className="font-mono-tight text-sm text-muted-foreground">
              {loadError ? 'Error de conexión — reintentando…' : 'Inicializando area·ai…'}
            </p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-white/[0.06] bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-display text-sm font-extrabold tracking-tight text-foreground/85">
              area<span className="bg-gradient-to-r from-[#f4536e] to-[#41c0ef] bg-clip-text text-transparent">·</span>ai
            </span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <p className="max-w-md text-[11.5px] leading-relaxed text-muted-foreground">
              Simulador educativo de ciberseguridad con agentes IA. Todo el combate ocurre en un
              entorno simulado y autorizado.
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
    </div>
  )
}
