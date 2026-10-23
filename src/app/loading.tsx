import { PageSkeleton } from '@/components/arena/skeletons'

// ─────────────────────────────────────────────────────────────
// Carga global: se muestra dentro del AppShell durante la
// navegación entre rutas mientras el segmento se prepara.
// ─────────────────────────────────────────────────────────────

export default function Loading() {
  return <PageSkeleton />
}
