'use client'

import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer, PageHeader } from '@/components/arena/shell/page-frame'
import { ModelStudioPanel } from '@/components/arena/model-studio'

// ─────────────────────────────────────────────────────────────
// /modelos — Model Studio como página: conexión del proveedor
// LLM, catálogo de modelos y activación del motor.
// ─────────────────────────────────────────────────────────────

function ModelosPage() {
  const { refresh } = useArena()

  return (
    <PageContainer>
      <PageHeader
        kicker="LLM engine"
        title="Model Studio"
        subtitle="Connect your OpenAI-compatible LLM provider, download the model catalog and pick the agents' brain. The configuration is saved to the arena's database and the next campaign will use the activated model."
      />
      <ModelStudioPanel onSaved={refresh} />
    </PageContainer>
  )
}

export default function Modelos() {
  return (
    <ArenaGate>
      <ModelosPage />
    </ArenaGate>
  )
}
