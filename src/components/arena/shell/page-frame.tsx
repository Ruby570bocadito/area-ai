'use client'

import { motion } from 'framer-motion'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useArena } from './arena-provider'
import { PageSkeleton } from '../skeletons'

// ─────────────────────────────────────────────────────────────
// Frame común de página: contenedor con ancho máx., cabecera
// con kicker/título/subtítulo y puerta de carga mientras llega
// el estado del motor. Mantiene cada ruta fina y consistente.
// ─────────────────────────────────────────────────────────────

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8"
    >
      {children}
    </motion.div>
  )
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && (
          <p className="font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-400">
            {kicker}
          </p>
        )}
        <h1 className="font-display mt-1.5 text-[22px] font-bold tracking-tight text-ink-900 sm:text-[26px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function ArenaGate({ children }: { children: React.ReactNode }) {
  const { state, status, refresh } = useArena()

  if (!state) {
    if (status === 'offline') {
      // El primer sondeo ha fallado de forma consistente: en lugar de un
      // esqueleto eterno, explicarlo y ofrecer reintento manual.
      return (
        <PageContainer>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center" role="alert">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#fecdca] bg-[#fef3f2]">
              <WifiOff className="h-5 w-5 text-[#b42318]" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink-900">Sin conexión con el motor</h2>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-500">
                No hay respuesta del servidor. Seguimos reintentando automáticamente cada pocos segundos;
                también puedes probar de nuevo de forma manual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar ahora
            </button>
          </div>
        </PageContainer>
      )
    }
    // Primera carga de /api/state pendiente: esqueleto con la forma
    // de página en lugar del vacío anterior (spinner + texto).
    return (
      <PageContainer>
        <div role="status" aria-live="polite">
          <p className="sr-only">Conectando con el motor…</p>
          <PageSkeleton />
        </div>
      </PageContainer>
    )
  }

  return <>{children}</>
}
