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
        kicker="Data intelligence"
        title="Laboratory analytics"
        subtitle="Aggregate reading of every campaign: victory balance, score evolution, agent leaderboard by experience, per-scenario balance comparison and which knowledge lessons work best in combat."
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
