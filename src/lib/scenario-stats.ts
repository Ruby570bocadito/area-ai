import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Balance por escenario (Ronda 12, implementaciones).
//
// Módulo puro (sin React ni DOM), patrón aggregate-report.ts /
// knowledge-score.ts: agrega el archivo de campañas por escenario
// para alimentar la matriz «Balance por escenario» de /analitica,
// cuyas filas enlazan al historial prefiltrado vía
// /historial?escenario=<codename>.
//
// Convenciones alineadas con aggregate-report.ts:
//   · «finalizada» = status COMPLETED (RUNNING y el resto no cuentan).
//   · empate = COMPLETED con winner distinto de RED/BLUE (DRAW o null).
//   · los porcentajes de victoria se calculan SOBRE las finalizadas
//     (las en curso no diluyen el balance) — mismo criterio que el
//     donut de resultados de /analitica.
// ─────────────────────────────────────────────────────────────

export interface ScenarioStats {
  codename: string
  company: string
  industry: string
  difficulty: number
  /** Campañas totales del escenario (cualquier estado). */
  total: number
  /** Campañas finalizadas (COMPLETED). */
  completed: number
  /** Victorias RED sobre finalizadas. */
  red: number
  /** Victorias BLUE sobre finalizadas. */
  blue: number
  /** Empates sobre finalizadas (winner DRAW o null). */
  draws: number
  /** Campañas en curso. */
  running: number
  /** Campañas abortadas (ni COMPLETED ni RUNNING). */
  aborted: number
  /** % de victorias RED sobre finalizadas (0 sin finalizadas). */
  redPct: number
  /** % de victorias BLUE sobre finalizadas (0 sin finalizadas). */
  bluePct: number
  /** Progreso medio de RED en finalizadas (null sin finalizadas). */
  avgRedProgress: number | null
  /** Progreso medio de BLUE en finalizadas (null sin finalizadas). */
  avgBlueProgress: number | null
}

/**
 * Agrega las campañas por escenario (codename). El orden devuelto es
 * determinista: más campañas primero; a igual número, codename
 * alfabético — para que la matriz no baile entre renders.
 */
export function buildScenarioStats(campaigns: CampaignListItemDTO[]): ScenarioStats[] {
  const byCodename = new Map<string, CampaignListItemDTO[]>()
  for (const c of campaigns) {
    const rows = byCodename.get(c.scenario.codename)
    if (rows) rows.push(c)
    else byCodename.set(c.scenario.codename, [c])
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const mean = (vals: number[]) =>
    vals.length > 0 ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null

  const stats = [...byCodename.entries()].map(([codename, rows]) => {
    const completed = rows.filter((c) => c.status === 'COMPLETED')
    const red = completed.filter((c) => c.winner === 'RED').length
    const blue = completed.filter((c) => c.winner === 'BLUE').length
    const draws = completed.length - red - blue
    const running = rows.filter((c) => c.status === 'RUNNING').length
    return {
      codename,
      company: rows[0].scenario.company,
      industry: rows[0].scenario.industry,
      difficulty: rows[0].scenario.difficulty,
      total: rows.length,
      completed: completed.length,
      red,
      blue,
      draws,
      running,
      aborted: rows.length - completed.length - running,
      redPct: completed.length > 0 ? Math.round((red / completed.length) * 100) : 0,
      bluePct: completed.length > 0 ? Math.round((blue / completed.length) * 100) : 0,
      avgRedProgress: mean(completed.map((c) => c.redProgress)),
      avgBlueProgress: mean(completed.map((c) => c.blueProgress)),
    }
  })

  return stats.sort((a, b) => b.total - a.total || a.codename.localeCompare(b.codename))
}
