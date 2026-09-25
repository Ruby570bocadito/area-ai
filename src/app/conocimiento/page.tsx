'use client'

import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { KnowledgePanel } from '@/components/arena/knowledge-panel'

// ─────────────────────────────────────────────────────────────
// /conocimiento — Memoria del sistema: cada campaña archiva
// lecciones que se inyectan en las siguientes.
// ─────────────────────────────────────────────────────────────

function ConocimientoPage() {
  const { state } = useArena()
  if (!state) return null

  return (
    <PageContainer>
      <PageHeader
        kicker="Memoria del sistema"
        title="Base de conocimiento"
        subtitle="Cada campaña archiva lecciones que se inyectan en las siguientes: cuanto más se usa un conocimiento y mejor funciona, más sube su confianza. Ese es el bucle de autoevolución de area·ai."
      />
      <KnowledgePanel red={state.knowledge.red} blue={state.knowledge.blue} />
    </PageContainer>
  )
}

export default function Conocimiento() {
  return (
    <ArenaGate>
      <ConocimientoPage />
    </ArenaGate>
  )
}
