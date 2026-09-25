'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Swords } from 'lucide-react'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { HistoryPanel, type ResultFilter } from '@/components/arena/history-panel'
import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// /historial — Archivo completo de enfrentamientos: carga el
// listado íntegro desde /api/campaigns (el sondeo /api/state
// solo trae las 15 más recientes) con búsqueda, filtros y
// exportación CSV. Acepta ?resultado=RED|BLUE|DRAW|RUNNING
// para llegar prefiltrado desde los deep-links de /analitica.
// ─────────────────────────────────────────────────────────────

const VALID_RESULT: ResultFilter[] = ['ALL', 'RED', 'BLUE', 'DRAW', 'RUNNING']

function FilteredHistoryPanel({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('resultado')?.toUpperCase() ?? 'ALL'
  const initialResult = VALID_RESULT.includes(raw as ResultFilter) ? (raw as ResultFilter) : 'ALL'
  return <HistoryPanel campaigns={campaigns} initialResult={initialResult} />
}

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
      <Suspense
        fallback={
          <div className="panel flex min-h-[200px] items-center justify-center rounded-xl text-[#98a2b3]">
            <Swords className="h-5 w-5 animate-spin" />
          </div>
        }
      >
        <FilteredHistoryPanel campaigns={campaigns} />
      </Suspense>
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
