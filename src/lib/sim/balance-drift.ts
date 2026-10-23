// ─────────────────────────────────────────────────────────────
// Veredicto de deriva de balance — módulo puro.
//
// Petición del ROADMAP (balance-datos-archivo, [S]): decidir si el
// balance RED/BLUE deriva de forma persistente usando SOLO las
// campañas ya archivadas (coste cero en LLM — el script que lo
// alimenta no lanza campañas nuevas, solo lee la BD).
//
// Umbral acordado: solo una deriva PERSISTENTE (≥ 70 % del mismo
// ganador en 15+ campañas finalizadas dentro de la ventana D30)
// abre recalibración formal de pace.ts. Con menos muestra NO hay
// veredicto: recalibrar el ritmo sobre 3-4 campañas sería sobre-
// ajustar ruido (una sola campaña sesgada movería el estándar).
//
// Convenciones heredadas de scenario-stats.ts:
//   · «archivada» = status COMPLETED (RUNNING/ABORTED no cuentan
//     para el balance; el motor solo escribe winner al COMPLETED).
//   · empate = COMPLETED con winner distinto de RED/BLUE (DRAW o
//     null) — mismo criterio que el donut de /analitica.
//   · el progreso se analiza SIEMPRE acotado a [0,100] con
//     clampProgress de src/lib/victory.ts (fuente única de la
//     escala cerrada; filas históricas >100 son artefacto).
//
// El EMPATE sí puede ser el ganador dominante que abre la deriva:
// «todas las campañas acaban en tablas» (hallazgo H-003) es tanto
// un problema de balance como un RED que gana el 90 % — si la
// defensa siempre contiene, el arco dramático se rompe igual.
// ─────────────────────────────────────────────────────────────

import { clampProgress } from '../victory'

// ── Parámetros del veredicto ────────────────────────────────

/** Ventana de análisis en días (D30: solo campañas iniciadas en los últimos 30 días). */
export const DRIFT_WINDOW_DAYS = 30

/** Cuota mínima del ganador dominante sobre las archivadas (≥ 70 %). */
export const DRIFT_SHARE_THRESHOLD = 0.7

/** Mínimo de campañas archivadas en la ventana para emitir veredicto. */
export const DRIFT_MIN_SAMPLE = 15

/** Tolerancia numérica para el corte ≥ en la cuota (21/30 = 0.6999… en coma flotante). */
const SHARE_EPSILON = 1e-9

/** Fila mínima que el script alimenta desde la BD (desacoplado de Prisma). */
export interface BalanceCampaignRow {
  status: string // RUNNING | COMPLETED | ABORTED
  winner: string | null // RED | BLUE | DRAW | null (solo COMPLETED)
  redProgress: number
  blueProgress: number
  startedAt: Date
  engineMode?: string | null // LLM | SIM
  scenarioId?: string | null
}

/** Veredicto emitido: los DERIVA_* abren recalibración formal de pace.ts. */
export type BalanceVerdict =
  | 'SIN_DATOS'
  | 'MUESTRA_INSUFICIENTE'
  | 'SIN_DERIVA'
  | 'DERIVA_RED'
  | 'DERIVA_BLUE'
  | 'DERIVA_EMPATE'

export interface BalanceDriftReport {
  /** Ventana aplicada, en días (eco de DRIFT_WINDOW_DAYS). */
  ventanaDias: number
  /** Campañas dentro de la ventana D30 (cualquier estado). */
  totalVentana: number
  /** Archivadas analizadas (COMPLETED en la ventana). */
  archivadas: number
  /** Abortadas en la ventana (excluidas: sin winner por diseño del motor). */
  abortadas: number
  /** En curso en la ventana (excluidas: no diluyen el balance). */
  enCurso: number
  /** Distribución de ganadores sobre archivadas. */
  ganadores: { RED: number; BLUE: number; EMPATE: number }
  /** Ganador dominante (null sin muestra). */
  lider: 'RED' | 'BLUE' | 'EMPATE' | null
  /** Cuota del dominante sobre archivadas en [0,1] (null sin muestra). */
  shareLider: number | null
  /** Progreso final acotado [0,100] sobre archivadas. */
  progreso: {
    red: { media: number | null; min: number | null; max: number | null }
    blue: { media: number | null; min: number | null; max: number | null }
  }
  /** Desglose por escenario de las archivadas (orden: más finalizadas primero, luego id). */
  porEscenario: Array<{
    escenarioId: string
    finalizadas: number
    red: number
    blue: number
    empates: number
  }>
  /** Desglose por modo de motor (LLM/SIM): una deriva solo en SIM apunta a pace.ts; solo en LLM, a las decisiones del proveedor. */
  porModo: Array<{ modo: string; finalizadas: number; red: number; blue: number; empates: number }>
  veredicto: BalanceVerdict
  /** true SOLO cuando el veredicto abre recalibración formal de pace.ts. */
  abreRecalibracion: boolean
  /** Ecos de los umbrales acordados, para que el informe sea auditable. */
  umbralShare: number
  umbralMuestra: number
  /** Veredicto en lenguaje natural (una línea, para el log del script). */
  mensaje: string
}

const PROGRESO_VACIO = { media: null, min: null, max: null } as const

/**
 * Agrega el archivo de campañas y emite el veredicto de deriva.
 * Puro y determinista: el reloj entra por `options.now` (testeable);
 * sin reloj, usa la hora actual.
 */
export function buildBalanceDrift(
  campaigns: BalanceCampaignRow[],
  options?: { now?: Date; ventanaDias?: number },
): BalanceDriftReport {
  const ventanaDias = options?.ventanaDias ?? DRIFT_WINDOW_DAYS
  const now = options?.now ?? new Date()
  const corte = new Date(now.getTime() - ventanaDias * 24 * 60 * 60 * 1000)

  // Ventana D30 por startedAt (límite inclusivo: exactamente el corte entra).
  const enVentana = campaigns.filter((c) => c.startedAt.getTime() >= corte.getTime())
  const archivadas = enVentana.filter((c) => c.status === 'COMPLETED')
  const abortadas = enVentana.filter((c) => c.status === 'ABORTED')
  const enCurso = enVentana.filter((c) => c.status !== 'COMPLETED' && c.status !== 'ABORTED')

  // Distribución de ganadores (cualquier winner no RED/BLUE es EMPATE).
  const ganadores = { RED: 0, BLUE: 0, EMPATE: 0 }
  for (const c of archivadas) {
    if (c.winner === 'RED') ganadores.RED += 1
    else if (c.winner === 'BLUE') ganadores.BLUE += 1
    else ganadores.EMPATE += 1
  }

  // Ganador dominante y cuota.
  let lider: BalanceDriftReport['lider'] = null
  let cuotaLider = 0
  if (archivadas.length > 0) {
    const pares: Array<['RED' | 'BLUE' | 'EMPATE', number]> = [
      ['RED', ganadores.RED],
      ['BLUE', ganadores.BLUE],
      ['EMPATE', ganadores.EMPATE],
    ]
    // Desempate determinista: mayor cuota, luego orden RED < BLUE < EMPATE.
    for (const [nombre, n] of pares) {
      if (n > cuotaLider) {
        lider = nombre
        cuotaLider = n
      }
    }
  }
  const shareLider = archivadas.length > 0 && lider !== null ? cuotaLider / archivadas.length : null

  // Progreso final acotado (solo archivadas).
  const progreso: BalanceDriftReport['progreso'] = {
    red: { ...PROGRESO_VACIO },
    blue: { ...PROGRESO_VACIO },
  }
  if (archivadas.length > 0) {
    const rojos = archivadas.map((c) => clampProgress(c.redProgress))
    const azules = archivadas.map((c) => clampProgress(c.blueProgress))
    const media = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100
    progreso.red = { media: media(rojos), min: Math.min(...rojos), max: Math.max(...rojos) }
    progreso.blue = { media: media(azules), min: Math.min(...azules), max: Math.max(...azules) }
  }

  // Desglose por escenario (solo archivadas; filas sin escenarioId se omiten).
  const porEscenarioMap = new Map<string, { finalizadas: number; red: number; blue: number; empates: number }>()
  for (const c of archivadas) {
    if (!c.scenarioId) continue
    let fila = porEscenarioMap.get(c.scenarioId)
    if (!fila) {
      fila = { finalizadas: 0, red: 0, blue: 0, empates: 0 }
      porEscenarioMap.set(c.scenarioId, fila)
    }
    fila.finalizadas += 1
    if (c.winner === 'RED') fila.red += 1
    else if (c.winner === 'BLUE') fila.blue += 1
    else fila.empates += 1
  }
  const porEscenario = [...porEscenarioMap.entries()]
    .map(([escenarioId, fila]) => ({ escenarioId, ...fila }))
    .sort((a, b) => b.finalizadas - a.finalizadas || a.escenarioId.localeCompare(b.escenarioId))

  // Desglose por modo de motor (LLM | SIM).
  const porModoMap = new Map<string, { finalizadas: number; red: number; blue: number; empates: number }>()
  for (const c of archivadas) {
    const modo = c.engineMode?.trim() || 'DESCONOCIDO'
    let fila = porModoMap.get(modo)
    if (!fila) {
      fila = { finalizadas: 0, red: 0, blue: 0, empates: 0 }
      porModoMap.set(modo, fila)
    }
    fila.finalizadas += 1
    if (c.winner === 'RED') fila.red += 1
    else if (c.winner === 'BLUE') fila.blue += 1
    else fila.empates += 1
  }
  const porModo = [...porModoMap.entries()]
    .map(([modo, fila]) => ({ modo, ...fila }))
    .sort((a, b) => b.finalizadas - a.finalizadas || a.modo.localeCompare(b.modo))

  // ── Veredicto ───────────────────────────────────────────
  let veredicto: BalanceVerdict
  let mensaje: string
  if (archivadas.length === 0) {
    veredicto = 'SIN_DATOS'
    mensaje =
      'Sin campañas archivadas en la ventana D30: no hay veredicto de balance ' +
      '(el análisis es coste cero; no se lanzan campañas para llenar la muestra).'
  } else if (archivadas.length < DRIFT_MIN_SAMPLE) {
    veredicto = 'MUESTRA_INSUFICIENTE'
    mensaje =
      `Muestra insuficiente (${archivadas.length} archivadas < ${DRIFT_MIN_SAMPLE}): sin veredicto de deriva. ` +
      'Recalibrar pace.ts con menos muestra sería sobreajustar ruido.'
  } else if (
    lider !== null &&
    shareLider !== null &&
    shareLider >= DRIFT_SHARE_THRESHOLD - SHARE_EPSILON
  ) {
    veredicto =
      lider === 'RED' ? 'DERIVA_RED' : lider === 'BLUE' ? 'DERIVA_BLUE' : 'DERIVA_EMPATE'
    const pct = Math.round(shareLider * 1000) / 10
    const quien = lider === 'EMPATE' ? 'el empate' : `el ${lider} TEAM`
    mensaje =
      `Deriva persistente: ${quien} cierra el ${pct} % de las ${archivadas.length} campañas archivadas ` +
      `en D30 (umbral ${DRIFT_SHARE_THRESHOLD * 100} %). Abre recalibración formal de pace.ts ` +
      '(con propuesta cuantificada y tests del contrato actualizados).'
  } else {
    veredicto = 'SIN_DERIVA'
    const pctLider = shareLider === null ? 0 : Math.round(shareLider * 1000) / 10
    const quien = lider === null ? '—' : lider === 'EMPATE' ? 'el empate' : `el ${lider} TEAM`
    mensaje =
      `Sin deriva persistente: el resultado dominante (${quien}) concentra un ${pctLider} % de las ` +
      `${archivadas.length} archivadas, por debajo del umbral (${DRIFT_SHARE_THRESHOLD * 100} % en ` +
      `${DRIFT_MIN_SAMPLE}+ campañas). pace.ts sigue como está.`
  }
  const abreRecalibracion =
    veredicto === 'DERIVA_RED' || veredicto === 'DERIVA_BLUE' || veredicto === 'DERIVA_EMPATE'

  return {
    ventanaDias,
    totalVentana: enVentana.length,
    archivadas: archivadas.length,
    abortadas: abortadas.length,
    enCurso: enCurso.length,
    ganadores,
    lider,
    shareLider,
    progreso,
    porEscenario,
    porModo,
    veredicto,
    abreRecalibracion,
    umbralShare: DRIFT_SHARE_THRESHOLD,
    umbralMuestra: DRIFT_MIN_SAMPLE,
    mensaje,
  }
}
