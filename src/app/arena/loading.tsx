import { SkeletonBlock } from '@/components/arena/skeletons'

// ─────────────────────────────────────────────────────────────
// Carga de /arena: esqueleto con la forma real de la página
// (mapa de red a la izquierda, feed de eventos a la derecha).
// ─────────────────────────────────────────────────────────────

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <div className="mb-6 space-y-2.5">
        <SkeletonBlock className="h-2.5 w-20" />
        <SkeletonBlock className="h-6 w-56" />
        <SkeletonBlock className="h-3.5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel rounded-2xl p-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-6 w-24 rounded-full" />
          </div>
          <SkeletonBlock className="mt-4 h-[320px] w-full rounded-xl sm:h-[400px]" />
          <div className="mt-4 grid grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="panel rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <SkeletonBlock className="mt-0.5 h-2 w-2 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBlock className={i % 3 === 0 ? 'h-3 w-[92%]' : 'h-3 w-[75%]'} />
                  <SkeletonBlock className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
