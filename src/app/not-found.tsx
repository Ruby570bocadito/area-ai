import Link from 'next/link'
import { Compass, LayoutDashboard, History } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// 404 global: ruta inexistente o contenido movido. Se muestra
// dentro del AppShell, con salidas directas a las zonas útiles.
// ─────────────────────────────────────────────────────────────

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="panel w-full max-w-md rounded-2xl p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-surface-200 bg-surface-100">
          <Compass className="h-5 w-5 text-ink-500" />
        </span>
        <p className="font-mono-tight mt-4 text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-400">
          Error 404
        </p>
        <h1 className="font-display mt-1.5 text-lg font-bold text-ink-900">
          This route does not exist in the laboratory
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          The page you are looking for is missing or has moved. Go back to the command deck
          or browse the campaign archive.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230]"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Go to the deck
          </Link>
          <Link
            href="/historial"
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-50"
          >
            <History className="h-3.5 w-3.5" />
            View history
          </Link>
        </div>
      </div>
    </div>
  )
}
