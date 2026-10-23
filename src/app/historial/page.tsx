'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
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
// exportación CSV. Acepta deep-links prefiltrados:
//   · ?resultado=RED|BLUE|DRAW|RUNNING (desde /analitica)
//   · ?escenario=CODENAME (desde el balance por escenario, R12)
//   · ?q=TEXTO (búsqueda libre)
// y con onFiltersChange los filtros vivos se reescriben en la
// URL (deep-links-historial): la vista filtrada es compartible
// y sobrevive a recargas.
// ─────────────────────────────────────────────────────────────

const VALID_RESULT: ResultFilter[] = ['ALL', 'RED', 'BLUE', 'DRAW', 'RUNNING']

// Tope defensivo del texto de búsqueda en la URL (por peticiones
// construidas a mano; la UI no genera cadenas largas).
const MAX_QUERY_LEN = 120

// deep-links-historial: reescribe los filtros vivos en la URL SIN navegación
// (window.history.replaceState es soportado nativamente por el App Router:
// no dispara recarga ni round-trip de router). Solo se escriben los
// parámetros que difieren del estado neutro; sin filtros → URL limpia.
function syncFiltersToUrl(f: { result: ResultFilter; scenario: string; query: string }) {
  const params = new URLSearchParams()
  if (f.result !== 'ALL') params.set('resultado', f.result)
  if (f.scenario !== 'ALL') params.set('escenario', f.scenario)
  const q = f.query.trim().slice(0, MAX_QUERY_LEN)
  if (q !== '') params.set('q', q)
  const qs = params.toString()
  window.history.replaceState(null, '', qs !== '' ? `${window.location.pathname}?${qs}` : window.location.pathname)
}

function FilteredHistoryPanel({ campaigns }: { campaigns: CampaignListItemDTO[] }) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('resultado')?.toUpperCase() ?? 'ALL'
  const initialResult = VALID_RESULT.includes(raw as ResultFilter) ? (raw as ResultFilter) : 'ALL'
  const rawScenario = searchParams.get('escenario')?.trim() ?? ''
  const initialScenario = rawScenario !== '' ? rawScenario : 'ALL'
  const initialQuery = searchParams.get('q')?.trim().slice(0, MAX_QUERY_LEN) ?? ''
  const onFiltersChange = useCallback((f: { result: ResultFilter; scenario: string; query: string }) => {
    syncFiltersToUrl(f)
  }, [])
  return (
    <HistoryPanel
      campaigns={campaigns}
      initialResult={initialResult}
      initialScenario={initialScenario}
      initialQuery={initialQuery}
      onFiltersChange={onFiltersChange}
    />
  )
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
        kicker="Archive"
        title="Campaign history"
        subtitle="Complete archive of engagements: scoreboard, duration, scenario and outcome. Filter, export to CSV and open any campaign's record to review its real commands and the lessons it archived."
      />
      <Suspense
        fallback={
          <div className="panel flex min-h-[200px] items-center justify-center rounded-xl text-ink-400">
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
