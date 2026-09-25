'use client'

import { useEffect, useState } from 'react'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { HistoryPanel } from '@/components/arena/history-panel'
import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// /historial — Archivo completo de enfrentamientos: carga el
// listado íntegro desde /api/campaigns (el sondeo /api/state
// solo trae las 15 más recientes) con búsqueda, filtros y
// exportación CSV.
// ─────────────────────────────────────────────────────────────

function HistorialPage() {
  const { state } = useArena()
  const [all, setAll] = useState<CampaignListItemDTO[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/campaigns', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { ok: boolean; campaigns?: CampaignListItemDTO[] }) => {
        // fallback silencioso si falla: se usa el listado del sondeo
        if (alive && data.ok && data.campaigns) setAll(data.campaigns)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const campaigns = all ?? state?.campaigns ?? []

  return (
    <PageContainer>
      <PageHeader
        kicker="Archivo"
        title="Historial de campañas"
        subtitle="Archivo completo de enfrentamientos: marcador, duración, escenario y resultado. Filtra, exporta a CSV y abre la ficha de cualquier campaña para revisar sus comandos reales y las lecciones que archivó."
      />
      <HistoryPanel campaigns={campaigns} />
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
