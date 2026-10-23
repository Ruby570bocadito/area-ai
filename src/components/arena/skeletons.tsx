import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Primitivas de esqueleto compartidas. Componentes puros sin
// estado ni eventos (compatibles con server components), usados
// por app/loading.tsx, por los loading.tsx de rutas principales
// y por ArenaGate mientras /api/state responde por primera vez.
// El parpadeo es solo de opacidad (animate-pulse), sin movimiento.
// ─────────────────────────────────────────────────────────────

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-200/80', className)} />
}

/** Esqueleto genérico de página: cabecera, fila de KPIs y dos paneles. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <div className="mb-6 space-y-2.5">
        <SkeletonBlock className="h-2.5 w-24" />
        <SkeletonBlock className="h-6 w-64" />
        <SkeletonBlock className="h-3.5 w-full max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel rounded-xl p-4">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-2 w-20" />
              <SkeletonBlock className="h-3.5 w-3.5" />
            </div>
            <SkeletonBlock className="mt-3 h-7 w-24" />
            <SkeletonBlock className="mt-2.5 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-5 lg:col-span-2">
          <SkeletonBlock className="h-4 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBlock className="h-8 w-8 shrink-0 rounded-lg" />
                <SkeletonBlock className="h-3 flex-1" />
                <SkeletonBlock className={cn('h-3 w-16 shrink-0', i % 2 === 0 && 'w-20')} />
              </div>
            ))}
          </div>
        </div>
        <div className="panel rounded-2xl p-5">
          <SkeletonBlock className="h-4 w-28" />
          <div className="mt-4 space-y-3.5">
            {['w-full', 'w-[86%]', 'w-[92%]', 'w-[70%]', 'w-[88%]'].map((w, i) => (
              <SkeletonBlock key={i} className={cn('h-3', w)} />
            ))}
          </div>
          <SkeletonBlock className="mt-6 h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
