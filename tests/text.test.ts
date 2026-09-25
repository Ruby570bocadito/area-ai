import { describe, expect, test } from 'bun:test'
import { formatDuration, normalizeText } from '../src/lib/text'

// ─────────────────────────────────────────────────────────────
// Contrato de las utilidades puras de src/lib/text.ts.
//
// formatDuration es la fuente única de formato de duraciones de
// toda la app (ficha de detalle, informe agregado del archivo).
// El mismo formato queda fijado byte a byte por el contrato de
// tests/aggregate-report.test.ts ("10m 00s"); estos tests añaden
// los casos que aquel informe no cubre (horas, inválidos) y
// cubren normalizeText, que hasta ahora no tenía suite.
// ─────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  test('menos de un minuto: solo segundos', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(1_000)).toBe('1s')
  })

  test('menos de una hora: minutos y segundos a 2 dígitos', () => {
    expect(formatDuration(600_000)).toBe('10m 00s')
    expect(formatDuration(605_000)).toBe('10m 05s')
    expect(formatDuration(3_599_000)).toBe('59m 59s')
  })

  test('una hora o más: horas y minutos (los segundos se redondean)', () => {
    expect(formatDuration(3_600_000)).toBe('1h 00m')
    expect(formatDuration(7_500_000)).toBe('2h 05m')
  })

  test('redondeo al segundo más próximo', () => {
    expect(formatDuration(1_499)).toBe('1s')
    expect(formatDuration(500)).toBe('1s')
    expect(formatDuration(499)).toBe('0s')
  })

  test('duraciones inválidas o no positivas: guion largo', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-5_000)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('normalizeText', () => {
  test('búsqueda tolerante a acentos: "exfiltracion" encuentra "exfiltración"', () => {
    expect(normalizeText('exfiltración').includes(normalizeText('exfiltracion'))).toBe(true)
    expect(normalizeText('Exfiltración')).toBe('exfiltracion')
  })

  test('insensible a mayúsculas y diacríticos combinados', () => {
    expect(normalizeText('ÁBACO')).toBe('abaco')
    expect(normalizeText('OPERACIÓN CENTINELA')).toBe('operacion centinela')
  })

  test('cadenas sin acentos quedan intactas (salvo minúsculas)', () => {
    expect(normalizeText('DATA_EXFIL')).toBe('data_exfil')
    expect(normalizeText('sql')).toBe('sql')
  })
})
