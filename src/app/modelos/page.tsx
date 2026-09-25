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
        kicker="Motor LLM"
        title="Model Studio"
        subtitle="Conecta tu proveedor LLM compatible OpenAI, descarga el catálogo de modelos y elige el cerebro de los agentes. La configuración se guarda en la base de datos de la arena y la próxima campaña usará el modelo activado."
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
