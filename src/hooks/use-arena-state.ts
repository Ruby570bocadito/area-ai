'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import type { StateResponse } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Estado vivo del laboratorio: carga + sondeo adaptativo +
// lanzamiento de campañas. Compartido vía ArenaProvider para
// toda la aplicación multi-página. Además, avisa con un toast
// cuando una campaña que estaba en directo finaliza (visible
// sobre todo con "Operación continua" activada).
// ─────────────────────────────────────────────────────────────

function winnerLabel(winner: string | null): string {
  if (winner === 'RED') return 'Victoria del RED TEAM'
  if (winner === 'BLUE') return 'Victoria del BLUE TEAM'
  return 'Empate táctico'
}

export function useArenaState() {
  const [state, setState] = useState<StateResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const stateRef = useRef<StateResponse | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' })
      const data = (await res.json()) as StateResponse
      if (data.ok) {
        setState(data)
        stateRef.current = data
        setLoadError(false)
      }
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Sondeo adaptativo: rápido en campaña en vivo, lento en reposo
  useEffect(() => {
    const running = state?.activeCampaign != null
    const id = setInterval(() => void load(), running ? 2000 : 6000)
    return () => clearInterval(id)
  }, [state?.activeCampaign, load])

  // Aviso de fin de campaña: transición RUNNING→COMPLETED observada
  // en el sondeo (no se avisa si la campaña ya estaba finalizada al abrir).
  const lastSeenRef = useRef<{ id: string; status: string } | null>(null)
  const liveId = state?.liveCampaign?.id
  const liveStatus = state?.liveCampaign?.status
  useEffect(() => {
    const live = state?.liveCampaign
    if (!live) return
    const prev = lastSeenRef.current
    lastSeenRef.current = { id: live.id, status: live.status }
    if (prev && prev.id === live.id && prev.status === 'RUNNING' && live.status === 'COMPLETED') {
      toast({
        title: `${winnerLabel(live.winner)} — ${live.scenario.codename}`,
        description: `Marcador ${live.redScore}–${live.blueScore} · progreso de objetivos RED ${live.redProgress}% vs BLUE ${live.blueProgress}% (el ganador se decide por objetivos). La ficha completa está en Historial.`,
        // el provider de radix auto-cierra a 5s: este aviso merece más tiempo
        duration: 12000,
      })
    }
  }, [liveId, liveStatus, state?.liveCampaign, toast])

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
            ? 'El motor lanzará campañas reales en segundo plano sin parar.'
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
