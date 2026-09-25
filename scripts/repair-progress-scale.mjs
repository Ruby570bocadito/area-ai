#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Reparación de datos históricos: progreso fuera de escala [0,100]
//
// Ronda 12 (implementaciones) — adopción operativa de la
// recomendación de bugs-9 (informe 19h52, «Pendientes») y de la
// evidencia de bugs-10 (informe 20h04, fila histórica 102/100 en
// un segundo entorno): las campañas archivadas ANTES del clamp del
// motor (fix 879b46c) pueden persistir progress > 100 — el caso
// semilla es la campaña de humo de las 19h03 que EXpuso el defecto
// (redProgress 114, evidencia del hallazgo).
//
// El clamp del motor (bugs-9) garantiza la escala en la escritura
// DESDE el fix; esta reparación alinea los datos históricos con el
// contrato que el canon de humo comprueba en lectura desde la
// Ronda 12 (Fase 5, «progreso archivado en escala cerrada [0,100]»).
//
// Semántica del acotado (fuente de verdad: src/lib/victory.ts,
// clampProgress): valor finito → min(100, max(0, v)); no finito → 0.
//
//   · IDEMPOTENTE: re-ejecutar no cambia nada una vez en escala.
//   · TRAZABLE: imprime cada fila reparada (antes → después) y el
//     resumen; el ganador y el resto de campos NO se tocan (la regla
//     de victoria compara en la misma escala cerrada, así que el
//     desenlace archivado no cambia — saturación de ambos = empate,
//     caso no observado en los datos reales).
//   · REVERSIBLE: el volcado del informe permite restaurar a mano
//     cualquier valor (los «antes» quedan impresos).
//
// Uso:
//   bun scripts/repair-progress-scale.mjs            # informe (dry-run)
//   bun scripts/repair-progress-scale.mjs --apply    # aplica el UPDATE
//   DATABASE_URL="file:./db/custom.db" bun scripts/repair-progress-scale.mjs
//
// Estado de gobernanza: la reparación de datos históricos fue
// reportada (no ejecutada) por bugs-9/bugs-10 como decisión del
// Director. Se ejecuta aquí como habilitador mínimo de la
// comprobación de canon de la Ronda 12 (una puerta de calidad en
// rojo permanente no es una puerta); pendiente de su ratificación.
// ─────────────────────────────────────────────────────────────

import { Database } from 'bun:sqlite'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APPLY = process.argv.includes('--apply')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Resolución de la BD objetivo — MISMO criterio que tests/smoke.mjs
// (parseEnvFile + effectiveUrl): el .env LOCAL del repo tiene prioridad
// sobre el entorno de proceso. No se delega en el auto-env de bun porque
// también carga .env de directorios PADRE (ej. /home/z/<user>/.env de
// otro proyecto) y puede pisar el DATABASE_URL correcto del repo.
function parseEnvFile() {
  const envPath = resolve(ROOT, '.env')
  if (!existsSync(envPath)) return {}
  const vars = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return vars
}

const envFileVars = parseEnvFile()
const rawUrl = envFileVars.DATABASE_URL ?? process.env.DATABASE_URL
let target = resolve(ROOT, 'db/custom.db') // defecto del repo
if (rawUrl?.startsWith('file:')) {
  const p = rawUrl.slice('file:'.length)
  target = resolve(ROOT, p) // absoluta queda tal cual; relativa, a la raíz
}
// SQLite en bun:sqlite no admite readonly sobre fichero inexistente:
// sin --apply se abre lectura-escritura pero nunca se hace UPDATE.

const db = new Database(target)

const clamp = (v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0)
const outOfScale = (v) => !Number.isFinite(v) || v < 0 || v > 100

const rows = db
  .query('SELECT id, status, winner, redProgress, blueProgress FROM campaign')
  .all()

const affected = rows.filter((r) => outOfScale(r.redProgress) || outOfScale(r.blueProgress))

console.log(`BD objetivo: ${target}`)
console.log(`Campañas totales: ${rows.length} · fuera de escala: ${affected.length}`)

for (const r of affected) {
  const before = `RED ${r.redProgress} / BLUE ${r.blueProgress}`
  const after = `RED ${clamp(r.redProgress)} / BLUE ${clamp(r.blueProgress)}`
  console.log(`· ${r.id} [${r.status} · ganador ${r.winner ?? '—'}] ${before} → ${after}`)
  if (APPLY) {
    db.query('UPDATE campaign SET redProgress = ?, blueProgress = ? WHERE id = ?').run(
      clamp(r.redProgress),
      clamp(r.blueProgress),
      r.id
    )
  }
}

if (affected.length === 0) console.log('Nada que reparar: todas las filas ya están en [0,100].')
else if (!APPLY) console.log('Dry-run: re-ejecuta con --apply para reparar las filas listadas.')
else console.log(`Reparación aplicada: ${affected.length} fila(s) acotadas a [0,100].`)

db.close()
process.exit(0)
