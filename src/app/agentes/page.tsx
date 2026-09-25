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
        kicker="Operadores"
        title="Agentes IA"
        subtitle="Diez operadores autónomos con especialidad, fases asignadas y memoria propia: ganan experiencia, suben de nivel y refinan sus tácticas campaña tras campaña. Abre cualquier ficha para ver su actividad real."
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
