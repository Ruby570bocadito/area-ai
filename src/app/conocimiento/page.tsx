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
        kicker="Memoria del sistema"
        title="Base de conocimiento"
        subtitle="Memoria completa del laboratorio: cada campaña archiva lecciones que se inyectan en las siguientes — cuanto más se usa una lección y mejor funciona, más sube su confianza. Busca, filtra por categoría y examina de dónde salió cada lección."
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
