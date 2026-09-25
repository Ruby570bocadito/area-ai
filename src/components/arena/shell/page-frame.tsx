'use client'

import { motion } from 'framer-motion'
import { Swords, WifiOff } from 'lucide-react'
import { useArena } from './arena-provider'

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
  kicker?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && (
          <p className="font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#98a2b3]">
            {kicker}
          </p>
        )}
        <h1 className="font-display mt-1.5 text-[22px] font-bold tracking-tight text-[#101828] sm:text-[26px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#667085]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function ArenaGate({ children }: { children: React.ReactNode }) {
  const { state, loadError } = useArena()

  if (!state) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#e4e7ec] bg-white shadow-sm"
          >
            <Swords className="h-6 w-6 text-[#667085]" />
          </motion.div>
          <p className="flex items-center gap-2 font-mono-tight text-xs text-[#667085]">
            {loadError && <WifiOff className="h-3.5 w-3.5 text-[#d92d20]" />}
            {loadError ? 'Error de conexión con el motor — reintentando…' : 'Conectando con el motor…'}
          </p>
        </div>
      </PageContainer>
    )
  }

  return <>{children}</>
}
