import type { CampaignListItemDTO } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Informe agregado del archivo de campañas (Markdown legible).
//
// Módulo puro (sin React ni DOM) extraído de history-panel.tsx
// para que el mismo texto alimente la descarga Y la copia al
// portapapeles, y para que el formato sea testeable de forma
// unitaria (tests/aggregate-report.test.ts). La regla de victoria
// recordada en el pie vive en src/lib/victory.ts (fuente única).
// ─────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function buildAggregateReport(
  campaigns: CampaignListItemDTO[],
  filtersDesc: string,
  now: Date = new Date()
): string {
  const completed = campaigns.filter((c) => c.status === 'COMPLETED')
  const running = campaigns.filter((c) => c.status === 'RUNNING')
  const aborted = campaigns.length - completed.length - running.length
  const redWins = completed.filter((c) => c.winner === 'RED').length
  const blueWins = completed.filter((c) => c.winner === 'BLUE').length
  const draws = completed.length - redWins - blueWins
  const pct = (n: number) => (completed.length > 0 ? `${Math.round((n / completed.length) * 1000) / 10}%` : '—')
  const avg = (nums: number[]) => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null)
  const fmtAvg = (v: number | null, digits = 0) => (v == null ? '—' : v.toFixed(digits))
  const avgRedProgress = avg(completed.map((c) => c.redProgress))
  const avgBlueProgress = avg(completed.map((c) => c.blueProgress))
  const avgRedScore = avg(completed.map((c) => c.redScore))
  const avgBlueScore = avg(completed.map((c) => c.blueScore))
  const durations = completed
    .filter((c) => c.endedAt)
    .map((c) => new Date(c.endedAt as string).getTime() - new Date(c.startedAt).getTime())
  const avgDuration = avg(durations)
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('es-ES') : '—')
  const scenarioTop = Object.entries(
    campaigns.reduce<Record<string, number>>((acc, c) => {
      acc[c.scenario.codename] = (acc[c.scenario.codename] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]

  const lines: string[] = [
    '# Informe agregado del archivo — area·ai',
    '',
    `- **Generado:** ${now.toLocaleString('es-ES')}`,
    `- **Campañas incluidas:** ${campaigns.length}`,
    `- **Filtros aplicados:** ${filtersDesc}`,
    '',
    '## Resumen ejecutivo',
    '',
    '| Métrica | Valor |',
    '| --- | --- |',
    `| Campañas incluidas | ${campaigns.length} |`,
    `| Finalizadas · en curso · abortadas | ${completed.length} · ${running.length} · ${aborted} |`,
    `| Victorias RED | ${redWins} (${pct(redWins)}) |`,
    `| Victorias BLUE | ${blueWins} (${pct(blueWins)}) |`,
    `| Empates | ${draws} (${pct(draws)}) |`,
    `| Progreso medio de objetivos (RED / BLUE) | ${fmtAvg(avgRedProgress)} / ${fmtAvg(avgBlueProgress)} de 100 |`,
    `| Puntuación media (RED / BLUE) | ${fmtAvg(avgRedScore, 1)} / ${fmtAvg(avgBlueScore, 1)} |`,
    `| Duración media de campaña | ${avgDuration == null ? '—' : formatDuration(avgDuration)} |`,
    `| Escenario más repetido | ${scenarioTop ? `${scenarioTop[0]} (${scenarioTop[1]} campaña${scenarioTop[1] === 1 ? '' : 's'})` : '—'} |`,
    '',
    '> Recuerda: el ganador se decide por progreso de objetivos (≥70 y por delante del rival); la puntuación refleja impacto y detecciones.',
    '',
    '## Campañas',
    '',
  ]

  for (const [i, c] of campaigns.entries()) {
    const winnerLabel =
      c.winner === 'RED'
        ? 'GANA RED'
        : c.winner === 'BLUE'
          ? 'GANA BLUE'
          : c.status === 'RUNNING'
            ? 'EN CURSO'
            : c.status === 'COMPLETED'
              ? 'EMPATE'
              : 'ABORTADA'
    const duration = c.endedAt
      ? formatDuration(new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime())
      : '—'
    lines.push(
      `### ${i + 1}. ${c.scenario.codename} — ${c.scenario.company} (${c.scenario.industry})`,
      '',
      `- **Resultado:** ${winnerLabel}${
        c.status === 'COMPLETED'
          ? ` · ${c.redScore}–${c.blueScore} (objetivos RED ${c.redProgress}% vs BLUE ${c.blueProgress}%)`
          : ''
      }`,
      `- **Periodo:** ${fmtDate(c.startedAt)} → ${fmtDate(c.endedAt)} (${duration})`,
      `- **Dificultad:** ${c.scenario.difficulty}/5`,
      `- **Ficha completa:** /historial/${c.id}`,
      ''
    )
  }

  lines.push(
    '---',
    'La telemetría completa de cada enfrentamiento (comandos reales, evidencia HTTP y lecciones archivadas) está disponible en la ficha de cada campaña y en su informe individual descargable.',
    'Generado por area·ai — laboratorio adversarial de agentes IA.'
  )

  return lines.join('\n')
}
