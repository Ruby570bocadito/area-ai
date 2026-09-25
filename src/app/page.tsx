'use client'

import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { useArenaState } from '@/hooks/use-arena-state'
import { Hero } from '@/components/arena/hero'
import { ControlCenter } from '@/components/arena/control-center'
import { ArenaLive } from '@/components/arena/arena-live'
import { KnowledgePanel } from '@/components/arena/knowledge-panel'
import { Roster } from '@/components/arena/roster'
import { HistoryPanel } from '@/components/arena/history-panel'
import { Analytics } from '@/components/arena/analytics'
import { ScrollProgress, BackToTop } from '@/components/arena/chrome'
import { Navbar } from '@/components/arena/layout/navbar'
import { Footer } from '@/components/arena/layout/footer'
import { ArenaSection } from '@/components/arena/layout/section-shell'

// ─────────────────────────────────────────────────────────────
// area·ai — composición de sub-partes.
// La lógica de estado vive en use-arena-state; el chrome en
// layout/; cada bloque de producto en su propio componente.
// ─────────────────────────────────────────────────────────────

export default function Home() {
  const { state, loadError, running, handleStart, toggleAutopilot, refresh } = useArenaState()

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* Capas globales de ambiente */}
      <ScrollProgress />
      <div className="noise-overlay" aria-hidden />

      <Navbar state={state} running={running} onStart={handleStart} onProviderSaved={() => void refresh()} />

      <main className="flex-1">
        {state ? (
          <>
            <Hero stats={state.stats} provider={state.provider} />

            <div className="mx-auto max-w-7xl space-y-16 px-4 pb-20 sm:px-6">
              {/* 01 — Escenarios + operación continua */}
              <ArenaSection
                id="mando"
                index="01"
                kicker="Centro de mando"
                title="Elige el campo de batalla"
                subtitle="Selecciona un escenario empresarial con infraestructura vulnerable y lanza una campaña autónoma Red vs Blue. El motor asigna agentes a cada fase y les inyecta todo el conocimiento acumulado para que decidan mejor que en la campaña anterior."
              >
                <ControlCenter
                  scenarios={state.scenarios}
                  running={running}
                  provider={state.provider}
                  disabled={running}
                  autopilot={state.autopilot}
                  onToggleAutopilot={toggleAutopilot}
                  onStart={handleStart}
                />
              </ArenaSection>

              {/* 02 — Arena en vivo */}
              {state.liveCampaign && (
                <ArenaSection
                  id="arena"
                  index="02"
                  kicker="Telemetría"
                  title={running ? 'Combate en directo' : 'Última campaña'}
                  subtitle="Mapa de red de la infraestructura objetivo con vulnerabilidades y controles reales, cadena de ataque, decisiones de cada agente IA y estado de los nodos comprometidos o endurecidos."
                >
                  <ArenaLive
                    campaign={state.liveCampaign}
                    events={state.liveEvents}
                    agents={state.agents}
                    infraNodes={state.liveInfra?.nodes ?? []}
                    running={running}
                  />
                </ArenaSection>
              )}

              {/* 03 — Base de conocimiento */}
              <ArenaSection
                id="conocimiento"
                index="03"
                kicker="Memoria del sistema"
                title="Conocimiento en evolución"
                subtitle="Cada campaña archiva lecciones que se inyectan en las siguientes: cuanto más se usa un conocimiento y mejor funciona, más sube su confianza. Ese es el bucle de autoevolución de area·ai."
              >
                <KnowledgePanel red={state.knowledge.red} blue={state.knowledge.blue} />
              </ArenaSection>

              {/* 04 — Roster */}
              <ArenaSection
                id="agentes"
                index="04"
                kicker="Operadores"
                title="Roster de agentes IA"
                subtitle="Diez operadores autónomos con especialidad, fases asignadas y memoria propia: ganan experiencia, suben de nivel y refinan sus tácticas campaña tras campaña. Abre cualquier ficha para ver su actividad real."
              >
                <Roster agents={state.agents} />
              </ArenaSection>

              {/* 05 — Historial */}
              <ArenaSection
                id="historial"
                index="05"
                kicker="Archivo"
                title="Historial de campañas"
                subtitle="Archivo completo de enfrentamientos: marcador, duración, escenario y resultado. Descarga el informe de cualquier campaña y revisa cómo evolucionan ambos equipos."
              >
                <HistoryPanel campaigns={state.campaigns} />
              </ArenaSection>

              {/* 06 — Analítica */}
              <ArenaSection
                id="analitica"
                index="06"
                kicker="Inteligencia de datos"
                title="Analítica del laboratorio"
                subtitle="Lectura agregada de todas las campañas: balance de victorias, evolución de puntuaciones, ranking de agentes por experiencia y qué lecciones del conocimiento funcionan mejor en combate."
              >
                <Analytics agents={state.agents} campaigns={state.campaigns} knowledge={state.knowledge} stats={state.stats} />
              </ArenaSection>
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

      <BackToTop />
      <Footer state={state} />
    </div>
  )
}
