'use client'

import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { HistoryPanel } from '@/components/arena/history-panel'

// ─────────────────────────────────────────────────────────────
// /historial — Archivo completo de enfrentamientos con
// marcador, duración, escenario y resultado.
// ─────────────────────────────────────────────────────────────

function HistorialPage() {
  const { state } = useArena()
  if (!state) return null

  return (
    <PageContainer>
      <PageHeader
        kicker="Archivo"
        title="Historial de campañas"
        subtitle="Archivo completo de enfrentamientos: marcador, duración, escenario y resultado. Descarga el informe de cualquier campaña activa y revisa cómo evolucionan ambos equipos."
      />
      <HistoryPanel campaigns={state.campaigns} />
    </PageContainer>
  )
}

export default function Historial() {
  return (
    <ArenaGate>
      <HistorialPage />
    </ArenaGate>
  )
}
