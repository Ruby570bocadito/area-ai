'use client'

import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { Roster } from '@/components/arena/roster'

// ─────────────────────────────────────────────────────────────
// /agentes — Roster completo de operadores con fichas
// detalladas y actividad real extraída de la base de datos.
// ─────────────────────────────────────────────────────────────

function AgentesPage() {
  const { state } = useArena()
  if (!state) return null

  return (
    <PageContainer>
      <PageHeader
        kicker="Operators"
        title="AI agents"
        subtitle="Ten autonomous operators with a specialty, assigned phases and their own memory: they earn experience, level up and refine their tactics campaign after campaign. Open any card to see their real activity."
      />
      <Roster agents={state.agents} />
    </PageContainer>
  )
}

export default function Agentes() {
  return (
    <ArenaGate>
      <AgentesPage />
    </ArenaGate>
  )
}
