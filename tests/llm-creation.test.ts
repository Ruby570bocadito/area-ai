// ─────────────────────────────────────────────────────────────
// Test del plazo de creación del SDK z-ai (src/lib/sim/llm.ts)
//
// Hallazgo de la auditoría de seguridad (ronda 2026-09-25 18h04):
// ZAI.create() no tenía plazo propio; si colgara (red/DNS
// degradada), callZai quedaría colgado indefinidamente aunque sus
// llamadas posteriores sí lo tengan.
//
// Contrato exigido: una creación que NO responde debe degradar a
// `null` en llmText/llmJson dentro del plazo de la llamada (con
// techo de 10 s), SIN lanzar y sin cachear el rechazo (el
// reintento posterior vuelve a intentar crear el cliente).
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, mock, test } from 'bun:test'

// Proveedor externo inalcanzable (prioridad 2 de provider-config):
// falla rápido por conexión rechazada y deja la vía z-ai como única.
// Vía variables de entorno para no tocar la BD de quien ejecuta.
process.env.OPENAI_API_KEY = 'sk-test-unreachable'
process.env.OPENAI_BASE_URL = 'https://127.0.0.1:9' // puerto discard: conexión rechazada inmediata
process.env.OPENAI_MODEL = 'test-model'

// SDK cuya creación CUELGA para siempre (nunca resuelve ni rechaza):
// sin plazo de creación, llmText quedaría esperando indefinidamente.
mock.module('z-ai-web-dev-sdk', () => ({
  default: {
    create: () => new Promise(() => {}),
  },
}))

describe('creación del SDK z-ai acotada en el tiempo', () => {
  test('llmText resuelve null (no cuelga) cuando ZAI.create() no responde nunca', async () => {
    const { llmText } = await import('../src/lib/sim/llm')
    const t0 = performance.now()
    // plazo de llamada 400 ms: 2 reintentos internos de callZai ≈ 0,8 s
    // si el plazo de creación funciona; un colgado sería ∞.
    const out = await llmText('Responde solo con JSON.', 'Devuelve {"ok": true}', 400)
    const elapsed = performance.now() - t0
    expect(out).toBeNull()
    // cota holgada para CI lento: sin el fix, este test no terminaría nunca
    expect(elapsed).toBeLessThan(5000)
  })

  test('llmJson también degrada a null bajo una creación colgada', async () => {
    const { llmJson } = await import('../src/lib/sim/llm')
    const out = await llmJson<{ ok: boolean }>('Responde solo con JSON.', 'Devuelve {"ok": true}', 400)
    expect(out).toBeNull()
  })
})
