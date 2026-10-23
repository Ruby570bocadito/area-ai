import { SkeletonBlock } from '@/components/arena/skeletons'

// ─────────────────────────────────────────────────────────────
// Carga de la ficha de campaña /historial/[id]: resumen,
// progreso por equipos y paneles de detalle.
// ─────────────────────────────────────────────────────────────

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <div className="mb-6 space-y-2.5">
        <SkeletonBlock className="h-2.5 w-16" />
        <SkeletonBlock className="h-6 w-72" />
        <SkeletonBlock className="h-3.5 w-full max-w-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel rounded-xl p-4">
            <SkeletonBlock className="h-2 w-24" />
            <SkeletonBlock className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-2xl p-5">
          <SkeletonBlock className="h-4 w-44" />
          <SkeletonBlock className="mt-4 h-2 w-full rounded-full" />
          <SkeletonBlock className="mt-4 h-[120px] w-full rounded-xl" />
        </div>
        <div className="panel rounded-2xl p-5">
          <SkeletonBlock className="h-4 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBlock className="h-7 w-7 shrink-0 rounded-md" />
                <SkeletonBlock className={i % 2 === 0 ? 'h-3 flex-1' : 'h-3 w-[70%]'} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
