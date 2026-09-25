'use client'

import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { Analytics } from '@/components/arena/analytics'

// ─────────────────────────────────────────────────────────────
// /analitica — Lectura agregada de todas las campañas:
// balance de victorias, evolución, ranking y efectividad.
// ─────────────────────────────────────────────────────────────

function AnaliticaPage() {
  const { state } = useArena()
  if (!state) return null

  return (
    <PageContainer>
      <PageHeader
        kicker="Inteligencia de datos"
        title="Analítica del laboratorio"
        subtitle="Lectura agregada de todas las campañas: balance de victorias, evolución de puntuaciones, ranking de agentes por experiencia, comparativa del balance por escenario y qué lecciones del conocimiento funcionan mejor en combate."
      />
      <Analytics
        agents={state.agents}
        campaigns={state.campaigns}
        knowledge={state.knowledge}
        stats={state.stats}
      />
    </PageContainer>
  )
}

export default function Analitica() {
  return (
    <ArenaGate>
      <AnaliticaPage />
    </ArenaGate>
  )
}
