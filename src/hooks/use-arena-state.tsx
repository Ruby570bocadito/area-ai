'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { explainWinner } from '@/lib/victory'
import type { StateResponse } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Estado vivo del laboratorio: carga + sondeo adaptativo +
// lanzamiento de campañas. Compartido vía ArenaProvider para
// toda la aplicación multi-página.
//
// Además, detecta el FIN de una campaña entre sondeos (p. ej.
// con "Operación continua" activa) y avisa con un toast con el
// resultado, el motivo y acceso directo a la ficha, salvo que
// el usuario esté ya viendo la arena en directo.
// ─────────────────────────────────────────────────────────────

export function useArenaState() {
  const [state, setState] = useState<StateResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const stateRef = useRef<StateResponse | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()

  // Seguimiento de la campaña activa entre sondeos para detectar su fin
  const prevActiveIdRef = useRef<string | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())
  // Ruta actual vía ref: mantiene `load` estable (sin fetch extra al navegar)
  const pathnameRef = useRef<string | null>(null)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const announceFinished = useCallback(
    (prevActiveId: string, data: StateResponse) => {
      if (notifiedRef.current.has(prevActiveId)) return
      // El usuario en /arena ya ve la resolución en directo: no molestar
      if (pathnameRef.current?.startsWith('/arena')) return

      notifiedRef.current.add(prevActiveId)
      const finished = data.campaigns.find((c) => c.id === prevActiveId)

      if (!finished) {
        toast({
          title: 'La campaña ha finalizado',
          description: 'Consulta el resultado en el historial de campañas.',
          action: (
            <ToastAction altText="Abrir el historial de campañas" onClick={() => router.push('/historial')}>
              Ver historial
            </ToastAction>
          ),
        })
        return
      }

      const codename = finished.scenario.codename

      if (finished.status === 'ABORTED') {
        toast({
          title: `${codename} abortada`,
          description: 'La campaña se detuvo antes de completarse. Queda registrada en el archivo.',
          action: (
            <ToastAction altText={`Abrir la ficha de la campaña ${codename}`} onClick={() => router.push(`/historial/${finished.id}`)}>
              Ver ficha
            </ToastAction>
          ),
        })
        return
      }

      const winnerLabel = finished.winner === 'RED' ? 'gana RED' : finished.winner === 'BLUE' ? 'gana BLUE' : 'empate táctico'
      const autopilotNote = data.autopilot ? ' Operación continua encadena la siguiente campaña.' : ''
      toast({
        title: `${codename} — ${winnerLabel}`,
        description: `${explainWinner(finished.winner, finished.redProgress, finished.blueProgress)} Puntuación ${finished.redScore}–${finished.blueScore}.${autopilotNote}`,
        action: (
          <ToastAction altText={`Abrir la ficha de la campaña ${codename}`} onClick={() => router.push(`/historial/${finished.id}`)}>
            Ver ficha
          </ToastAction>
        ),
        duration: 12000,
      })
    },
    [router, toast]
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' })
      const data = (await res.json()) as StateResponse
      if (data.ok) {
        // Detección de fin de campaña: la activa anterior ya no lo es
        const prevActiveId = prevActiveIdRef.current
        const currentActiveId = data.activeCampaign?.id ?? null
        if (prevActiveId && prevActiveId !== currentActiveId) {
          announceFinished(prevActiveId, data)
        }
        prevActiveIdRef.current = currentActiveId

        setState(data)
        stateRef.current = data
        setLoadError(false)
      }
    } catch {
      setLoadError(true)
    }
  }, [announceFinished])

  useEffect(() => {
    void load()
  }, [load])

  // Sondeo adaptativo: rápido en campaña en vivo, lento en reposo
  useEffect(() => {
    const running = state?.activeCampaign != null
    const id = setInterval(() => void load(), running ? 2000 : 6000)
    return () => clearInterval(id)
  }, [state?.activeCampaign, load])

  const handleStart = useCallback(
    async (scenarioId?: string) => {
      try {
        const res = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioId }),
        })
        const data = (await res.json()) as { ok: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al iniciar la campaña')
        toast({
          title: 'Campaña iniciada',
          description: 'Los agentes IA están entrando en combate. Sigue la acción en la arena.',
        })
        await load()
        router.push('/arena')
      } catch (e) {
        toast({
          title: 'No se pudo iniciar la campaña',
          description: e instanceof Error ? e.message : 'Error desconocido',
          variant: 'destructive',
        })
      }
    },
    [load, toast, router]
  )

  const toggleAutopilot = useCallback(
    async (enabled: boolean) => {
      try {
        const res = await fetch('/api/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        const data = (await res.json()) as { ok: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error')
        toast({
          title: enabled ? 'Operación continua activada' : 'Operación continua detenida',
          description: enabled
            ? 'El motor lanzará campañas reales en segundo plano sin parar. Avisaremos al completar cada una.'
            : 'El motor terminará la campaña en curso y quedará en espera.',
        })
        await load()
      } catch (e) {
        toast({
          title: 'No se pudo cambiar el modo',
          description: e instanceof Error ? e.message : 'Error desconocido',
          variant: 'destructive',
        })
      }
    },
    [load, toast]
  )

  return { state, loadError, running: state?.activeCampaign != null, handleStart, toggleAutopilot, refresh: load }
}
