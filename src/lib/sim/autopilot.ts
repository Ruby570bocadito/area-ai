import { db } from '@/lib/db'
import { startCampaign } from './engine'

// ─────────────────────────────────────────────────────────────
// OPERACIÓN CONTINUA — modo automático real del motor.
// Cuando está activo, el motor lanza campañas reales (con LLM o
// en modo determinista) sin intervención humana, dejando un
// periodo de calma entre campañas. No simula nada: cada campaña
// pasa por el mismo engine.startCampaign que la UI manual.
// ─────────────────────────────────────────────────────────────

const SETTING_KEY = 'autopilot'
/** Pausa entre el fin de una campaña y el inicio de la siguiente (ms) */
const COOLDOWN_MS = 12_000

export async function getAutopilot(): Promise<boolean> {
  const s = await db.setting.findUnique({ where: { key: SETTING_KEY } })
  return s?.value === 'on'
}

export async function setAutopilot(on: boolean): Promise<boolean> {
  const value = on ? 'on' : 'off'
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value },
    update: { value },
  })
  return on
}

/**
 * Intenta arrancar la siguiente campaña si el modo está activo y el
 * motor está ocioso. Lo invoca /api/state en cada sondeo, de modo que
 * el bucle funciona en segundo plano sin hilos ni temporizadores.
 */
export async function maybeRunAutopilot(): Promise<{ started: boolean }> {
  try {
    if (!(await getAutopilot())) return { started: false }

    const running = await db.campaign.findFirst({ where: { status: 'RUNNING' } })
    if (running) return { started: false }

    const last = await db.campaign.findFirst({ orderBy: { startedAt: 'desc' } })
    if (last) {
      const ref = last.endedAt ?? last.startedAt
      if (Date.now() - new Date(ref).getTime() < COOLDOWN_MS) return { started: false }
    }

    // Campaña real con escenario aleatorio — el mismo camino que la UI
    await startCampaign()
    return { started: true }
  } catch (e) {
    // Carrera benigna: otra petición pudo arrancar campaña ya
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('Ya existe una campaña')) console.error('[autopilot]', msg)
    return { started: false }
  }
}
