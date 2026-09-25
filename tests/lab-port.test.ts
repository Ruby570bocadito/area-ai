// ─────────────────────────────────────────────────────────────
// Tests unitarios del puerto del laboratorio
// (src/lib/lab/runtime.ts — labPort, hallazgo Ronda 12 de bugs)
//
// Antes: `Number(process.env.LAB_PORT || 4403)` aceptaba NaN,
// negativos, 0 y puertos > 65535 — el error estallaba dentro del
// camino del motor (server.listen) en la primera campaña. Ahora
// un valor inválido degrada al defecto 4403.
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test'
import { labPort } from '../src/lib/lab/runtime'

function setLabPort(value: string | undefined) {
  if (value === undefined) delete process.env.LAB_PORT
  else process.env.LAB_PORT = value
}

afterEach(() => setLabPort(undefined))

describe('labPort — validación de rango (regresión Ronda 12)', () => {
  test('sin variable → defecto 4403', () => {
    setLabPort(undefined)
    expect(labPort()).toBe(4403)
  })

  test('valor válido se respeta', () => {
    setLabPort('4500')
    expect(labPort()).toBe(4500)
  })

  test('cadena no numérica → defecto (antes: NaN estallaba en listen)', () => {
    setLabPort('abc')
    expect(labPort()).toBe(4403)
  })

  test('puerto 0 → defecto', () => {
    setLabPort('0')
    expect(labPort()).toBe(4403)
  })

  test('puerto negativo → defecto', () => {
    setLabPort('-1')
    expect(labPort()).toBe(4403)
  })

  test('puerto > 65535 → defecto', () => {
    setLabPort('70000')
    expect(labPort()).toBe(4403)
  })

  test('decimal → defecto (no es un puerto entero)', () => {
    setLabPort('4403.5')
    expect(labPort()).toBe(4403)
  })
})
