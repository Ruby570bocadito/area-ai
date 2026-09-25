import { describe, expect, test } from 'bun:test'
import { csvEscapeCell, formatDateTime, formatDuration, normalizeText } from '../src/lib/text'

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

describe('formatDateTime', () => {
  test('fecha válida: mismo formato que el locale es-ES (contrato compartido con los informes)', () => {
    const d = '2026-09-25T19:03:00.000Z'
    expect(formatDateTime(d)).toBe(new Date(d).toLocaleString('es-ES'))
    expect(formatDateTime(d)).not.toBe('—')
  })

  test('nula o vacía: guion largo, igual que las duraciones inválidas', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  test('cadena no parseable: degradación explícita a guion largo (nunca "Invalid Date")', () => {
    expect(formatDateTime('no-es-una-fecha')).toBe('—')
  })
})

// ─────────────────────────────────────────────────────────────
// Contrato DIRECTO de csvEscapeCell (hardening HD2/HD2b — Ronda 16
// de bugs, D23 del reparto 11). Hasta ahora la fuente única del
// dialecto CSV solo tenía pinza indirecta vía knowledge-export;
// estos tests fijan byte a byte los dos mecanismos: neutralización
// de fórmulas (OWASP — prefijos =,+,-,@,tab,CR llevan apóstrofe) y
// escapado RFC 4180 (separador/comillas/saltos → comillas dobles).
// Cubre a las DOS exportaciones existentes (knowledge-export,
// history-panel) y a la tercera anunciada (telemetría de la ficha).
// ─────────────────────────────────────────────────────────────

describe('csvEscapeCell — neutralización de fórmulas (HD2, técnica OWASP)', () => {
  test('celda que empieza por = se prefija con apóstrofe (no evaluable como fórmula)', () => {
    // Contiene comillas → además del apóstrofe aplica el envuelto RFC 4180:
    // en la hoja la celda vale '=HYPERLINK("http://evil.example","clic") (texto).
    expect(csvEscapeCell('=HYPERLINK("http://evil.example","clic")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""clic"")"'
    )
    // Sin comillas dobles ni separador → solo apóstrofe, sin envuelto RFC 4180.
    expect(csvEscapeCell('=1+cmd|\' /C calc\'!A0')).toBe('\'=1+cmd|\' /C calc\'!A0')
  })

  test('celdas que empiezan por +, - y @ llevan apóstrofe', () => {
    expect(csvEscapeCell('+1')).toBe("'+1")
    expect(csvEscapeCell('-2')).toBe("'-2")
    expect(csvEscapeCell('@SUM(1)')).toBe("'@SUM(1)")
  })

  test('tab y CR iniciales llevan apóstrofe (smuggling de prefijo)', () => {
    expect(csvEscapeCell('\t=cmd')).toBe("'\t=cmd")
    expect(csvEscapeCell('\r=cmd')).toBe("'\r=cmd")
  })

  test('el apóstrofe solo toca el PRIMER carácter: prefijos en medio del texto intactos', () => {
    expect(csvEscapeCell('evolución -2% respecto de ayer')).toBe('evolución -2% respecto de ayer')
    expect(csvEscapeCell('lección: usar @función de apoyo')).toBe('lección: usar @función de apoyo')
  })

  test('celda con espacio inicial ya es texto inerte: sin apóstrofe, sin recortar el dato', () => {
    expect(csvEscapeCell(' =cmd')).toBe(' =cmd')
  })

  test('números no negativos de los exportadores quedan intactos', () => {
    expect(csvEscapeCell(0)).toBe('0')
    expect(csvEscapeCell(78)).toBe('78')
    expect(csvEscapeCell(100)).toBe('100')
  })
})

describe('csvEscapeCell — escapado RFC 4180 (contrato preexistente, ahora pinzado directo)', () => {
  test('celda normal sin caracteres especiales no se toca', () => {
    expect(csvEscapeCell('Lección: persistencia')).toBe('Lección: persistencia')
    expect(csvEscapeCell('RED')).toBe('RED')
  })

  test('separador, comillas y salto de línea envuelven en comillas dobles', () => {
    expect(csvEscapeCell('a;b')).toBe('"a;b"')
    expect(csvEscapeCell('dijo "hola"')).toBe('"dijo ""hola"""')
    expect(csvEscapeCell('linea1\nlinea2')).toBe('"linea1\nlinea2"')
  })

  test('la neutralización combina con el escapado en una sola celda', () => {
    // '=' inicial → apóstrofe; luego contiene ';' y '"' → envuelto y duplicado
    expect(csvEscapeCell('=1+2;="x"')).toBe('"\'=1+2;=""x"""')
  })

  test('apóstrofe de neutralización dentro de celda con salto: ambos mecanismos en orden', () => {
    expect(csvEscapeCell('@x\ny')).toBe('"\'@x\ny"')
  })
})
