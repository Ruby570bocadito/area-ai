import { SkeletonBlock } from '@/components/arena/skeletons'

// ─────────────────────────────────────────────────────────────
// Carga de /historial: esqueleto con buscador, chips de filtro
// y las filas de la tabla de campañas.
// ─────────────────────────────────────────────────────────────

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <div className="mb-6 space-y-2.5">
        <SkeletonBlock className="h-2.5 w-24" />
        <SkeletonBlock className="h-6 w-64" />
        <SkeletonBlock className="h-3.5 w-full max-w-xl" />
      </div>
      <div className="panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <SkeletonBlock className="h-9 w-full max-w-xs rounded-lg" />
          <SkeletonBlock className="h-9 w-32 rounded-lg" />
          <SkeletonBlock className="h-9 w-32 rounded-lg" />
          <SkeletonBlock className="ml-auto h-9 w-28 rounded-lg" />
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-surface-100 pt-3 first:border-t-0 first:pt-0">
              <SkeletonBlock className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonBlock className={i % 2 === 0 ? 'h-3 w-[55%]' : 'h-3 w-[42%]'} />
                <SkeletonBlock className="h-2.5 w-[28%]" />
              </div>
              <SkeletonBlock className="h-5 w-20 shrink-0 rounded-full" />
              <SkeletonBlock className="hidden h-3 w-14 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
