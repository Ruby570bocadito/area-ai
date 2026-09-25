// ─────────────────────────────────────────────────────────────
// Tests de regresión de la resiliencia LLM (src/lib/sim/llm.ts)
//
// Complemento a los tests de guard/access (target-guard.test.ts,
// access.test.ts): cubren la vía OpenAI-compatible del motor.
//
// Contrato exigido: un proveedor externo configurado pero caído
// (conexión rechazada, HTTP 5xx, respuesta no-JSON) debe resolver
// `null` SIN lanzar, de modo que el motor degrade a modo
// determinista en vez de abortar la campaña (ronda 17h41).
//
// Ejecutar: bun test tests/
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, mock, test } from 'bun:test'

// Config del proveedor vía env (prioridad 2 de provider-config):
// no toca la base de datos y aísla el test de rutas relativas ambiguas.
process.env.OPENAI_API_KEY = 'sk-test-unreachable'
process.env.OPENAI_BASE_URL = 'https://127.0.0.1:9' // puerto discard: conexión rechazada inmediata
process.env.OPENAI_MODEL = 'test-model'

// El fallback z-ai se mockea CAÍDO para exigir `null` final (si no, el SDK
// real de este entorno respondería y el resultado legítimo no sería null).
mock.module('z-ai-web-dev-sdk', () => ({
  default: {
    create: () => {
      throw new Error('mock: z-ai no disponible en este test')
    },
  },
}))

describe('resiliencia LLM con proveedor inalcanzable', () => {
  test('llmText devuelve null (no lanza) cuando TODOS los proveedores fallan', async () => {
    const { llmText } = await import('../src/lib/sim/llm')
    const out = await llmText('Responde solo con JSON.', 'Devuelve {"ok": true}', 1500)
    expect(out).toBeNull()
  })

  test('llmJson devuelve null (no lanza) en la misma situación', async () => {
    const { llmJson } = await import('../src/lib/sim/llm')
    const out = await llmJson<{ ok: boolean }>('Responde solo con JSON.', 'Devuelve {"ok": true}', 1500)
    expect(out).toBeNull()
  })

  test('la respuesta HTTP 200 con cuerpo no-JSON se descarta sin lanzar', async () => {
    const originalFetch = globalThis.fetch
    const fakeFetch = async (): Promise<Response> => new Response('not-json at all', { status: 200 })
    globalThis.fetch = fakeFetch as unknown as typeof fetch
    try {
      const { llmText } = await import('../src/lib/sim/llm')
      const out = await llmText('sys', 'user', 1500)
      expect(out).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
