// ─────────────────────────────────────────────────────────────
// Logs e informes sin secretos (tarea logs-sin-secretos del
// ROADMAP). Barrido del 2026-10-23: 19 console.* de src/ y los
// tres módulos de exportación — LIMPIO. Este test perpetúa el
// barrido: una línea de log que interpole credenciales o una
// exportación que toque claves rompe la suite aquí.
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(import.meta.dir, '../src')

// Patrones que NO deben aparecer jamás en una línea de log: claves de
// proveedor, credenciales de administración, cabeceras de autenticación,
// cookies ni secretos genéricos.
const SENSITIVE = /apikey|api_key|admin_token|authorization|x-admin-token|cookie|password|secret|bearer /i
const CONSOLE = /console\.(log|error|warn|info)\b/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(p)
  }
  return out
}

describe('logs-sin-secretos — barrido perpetuado', () => {
  test('ninguna línea de console.* en src/ interpola credenciales ni cabeceras sensibles', () => {
    const violations: string[] = []
    for (const file of sourceFiles(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (CONSOLE.test(line) && SENSITIVE.test(line)) {
          violations.push(`${relative(SRC, file)}:${i + 1} → ${line.trim().slice(0, 120)}`)
        }
      })
    }
    expect(violations.join('\n')).toBe('')
  })

  test('los módulos de exportación/informe no referencian credenciales', () => {
    const modules = ['aggregate-report.ts', 'event-export.ts', 'knowledge-export.ts']
    const violations: string[] = []
    for (const name of modules) {
      const content = readFileSync(resolve(SRC, 'lib', name), 'utf8')
      if (SENSITIVE.test(content)) {
        violations.push(`src/lib/${name} contiene un patrón sensible`)
      }
    }
    expect(violations.join('\n')).toBe('')
  })
})
