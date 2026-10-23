'use client'

import { useEffect, useState } from 'react'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { KnowledgePanel } from '@/components/arena/knowledge-panel'
import type { KnowledgeDTO, KnowledgeListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// /conocimiento — Memoria del sistema completa: carga TODAS las
// lecciones desde /api/knowledge (el sondeo /api/state solo
// trae el top-24 por equipo) con búsqueda, filtros por categoría
// y ordenación.
// ─────────────────────────────────────────────────────────────

function ConocimientoPage() {
  const { state } = useArena()
  const [full, setFull] = useState<{ red: KnowledgeListItemDTO[]; blue: KnowledgeListItemDTO[] } | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/knowledge', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { ok: boolean; knowledge?: KnowledgeListItemDTO[] }) => {
        // fallback silencioso si falla: se usa el top del sondeo
        if (alive && data.ok && data.knowledge) {
          setFull({
            red: data.knowledge.filter((k) => k.team === 'RED'),
            blue: data.knowledge.filter((k) => k.team === 'BLUE'),
          })
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const red: (KnowledgeDTO & { campaignCodename?: string | null })[] =
    full?.red ?? state?.knowledge.red ?? []
  const blue: (KnowledgeDTO & { campaignCodename?: string | null })[] =
    full?.blue ?? state?.knowledge.blue ?? []

  return (
    <PageContainer>
      <PageHeader
        kicker="System memory"
        title="Knowledge base"
        subtitle="The laboratory's full memory: every campaign archives lessons that are injected into later ones — the more a lesson is used and the better it works, the more its confidence grows. Search, filter by category and inspect where each lesson came from."
      />
      <KnowledgePanel red={red} blue={blue} />
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
