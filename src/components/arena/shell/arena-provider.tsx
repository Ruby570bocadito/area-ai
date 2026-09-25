'use client'

import { createContext, useContext } from 'react'
import { useArenaState } from '@/hooks/use-arena-state'

// ─────────────────────────────────────────────────────────────
// Contexto compartido del laboratorio: UN único sondeo de
// /api/state para toda la aplicación multi-página. El shell y
// cada página consumen useArena() sin duplicar peticiones.
// ─────────────────────────────────────────────────────────────

type ArenaStateValue = ReturnType<typeof useArenaState>

const ArenaContext = createContext<ArenaStateValue | null>(null)

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const value = useArenaState()
  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>
}

export function useArena(): ArenaStateValue {
  const ctx = useContext(ArenaContext)
  if (!ctx) throw new Error('useArena debe usarse dentro de ArenaProvider')
  return ctx
}
