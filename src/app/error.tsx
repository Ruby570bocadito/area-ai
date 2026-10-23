'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert, RefreshCw, LayoutDashboard } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Boundary de error global (client). Mantiene el AppShell con
// su navegación y ofrece reintento o salida al panel de mando.
// ─────────────────────────────────────────────────────────────

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="panel w-full max-w-md rounded-2xl p-8 text-center" role="alert">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#fecdca] bg-[#fef3f2]">
          <TriangleAlert className="h-5 w-5 text-[#b42318]" />
        </span>
        <h1 className="font-display mt-4 text-lg font-bold text-ink-900">Something got out of hand</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          An unexpected error occurred while rendering this page. The rest of the laboratory is still standing:
          you can retry or go back to the command deck.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono-tight text-[10.5px] text-ink-400">digest: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-50"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Go to the deck
          </Link>
        </div>
      </div>
    </div>
  )
}
