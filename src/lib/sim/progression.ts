import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────
// Progresión de agentes — curva de experiencia no lineal.
//
// Antes: level = 1 + floor(xp / 80) → lineal, con el autopiloto
// encadenando decenas de campañas los niveles se inflaban
// (Nv46). Ahora la curva es potencia: cada nivel requiere
// notablemente más XP que el anterior, así que tras muchas
// campañas los agentes quedan en niveles creíbles (8-15).
// ─────────────────────────────────────────────────────────────

const FLAG = 'progression-v2-applied'

/** Nivel derivado de XP con curva potencia (0 XP → Nv1) */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1
  return 1 + Math.floor(Math.pow(xp / 60, 0.6))
}

/** XP necesario para alcanzar un nivel dado (para barras de progreso) */
export function xpFloorForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.ceil(60 * Math.pow(level - 1, 1 / 0.6))
}

/** XP que falta para el siguiente nivel */
export function xpToNextLevel(xp: number): { have: number; need: number } {
  const level = levelForXp(xp)
  const have = xp - xpFloorForLevel(level)
  const need = xpFloorForLevel(level + 1) - xpFloorForLevel(level)
  return { have, need }
}

/**
 * Migración única: recalcula los niveles de todos los agentes con
 * la curva nueva (el XP acumulado se conserva). Se ejecuta una vez
 * vía ensureSeed y queda registrada en Setting para no repetirse.
 */
export async function ensureProgressionMigration(): Promise<void> {
  const applied = await db.setting.findUnique({ where: { key: FLAG } })
  if (applied) return

  const agents = await db.agent.findMany()
  for (const a of agents) {
    const level = levelForXp(a.xp)
    if (level !== a.level) {
      await db.agent.update({ where: { id: a.id }, data: { level } })
    }
  }
  await db.setting.create({ data: { key: FLAG, value: new Date().toISOString() } })
}
