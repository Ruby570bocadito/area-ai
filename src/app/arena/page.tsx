'use client'

import { motion } from 'framer-motion'
import { Radio, Swords } from 'lucide-react'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { ArenaLive } from '@/components/arena/arena-live'

// ─────────────────────────────────────────────────────────────
// /arena — Operaciones en vivo: telemetría completa de la
// campaña activa o de la última campaña ejecutada.
// ─────────────────────────────────────────────────────────────

function ArenaPage() {
  const { state, running, handleStart } = useArena()
  if (!state) return null

  return (
    <PageContainer>
      <PageHeader
        kicker="Telemetría"
        title="Operaciones en vivo"
        subtitle="Mapa de red de la infraestructura objetivo con vulnerabilidades y controles reales, cadena de ataque, decisiones de cada agente IA y estado de los nodos comprometidos o endurecidos."
      />

      {state.liveCampaign ? (
        <ArenaLive
          campaign={state.liveCampaign}
          events={state.liveEvents}
          agents={state.agents}
          infraNodes={state.liveInfra?.nodes ?? []}
          running={running}
          liveLab={state.liveLab}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="panel flex flex-col items-center gap-3.5 rounded-2xl px-6 py-14 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#e4e7ec] bg-[#f2f4f7]">
            <Radio className="h-5 w-5 text-[#667085]" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-[#101828]">Sin operaciones todavía</h2>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[#667085]">
              Cuando lances una campaña, aquí verás el mapa de la infraestructura, los haces de
              ataque y defensa, las decisiones de cada agente y el registro completo de eventos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={running}
            className="shine-sweep flex items-center gap-2 rounded-lg bg-[#101828] px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Swords className="h-4 w-4" />
            Lanzar primera campaña
          </button>
        </motion.div>
      )}
    </PageContainer>
  )
}

export default function Arena() {
  return (
    <ArenaGate>
      <ArenaPage />
    </ArenaGate>
  )
}
