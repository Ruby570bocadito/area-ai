// ─────────────────────────────────────────────────────────────
// Tests del autotuning de balance (autotuning-balance) —
// veredicto puro de pace.ts que alimenta scripts/autotuning-balance.mjs
//
// Contrato fijado aquí:
//
//   · La banda objetivo de RED es [0.4, 0.6] INCLUSIVA: 40 % y 60 %
//     exactos son EQUILIBRIO (el «objetivo orientativo 40-60 %» del
//     ROADMAP incluye el borde).
//   · Los EMPATES cuentan en el denominador: son campañas reales de
//     la muestra y ocultarlos inflaría la tasa y escondería la señal
//     de H-003 (todas empate) — la tasaEmpate se expone SIEMPRE.
//   · MUESTRA_CORTA (< 5 por defecto) publica la tasa como
//     INFORMACIÓN (enBanda calculado) pero no emite veredicto pleno:
//     con 2 campañas cada resultado mueve 50 puntos.
//   · SIN_DATOS (0 finalizadas): tasaRed y enBanda son null — el
//     informe distingue «sin muestra» de «muestra en cero».
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  AUTOTUNING_MUESTRA_MIN,
  AUTOTUNING_TASA_MAX,
  AUTOTUNING_TASA_MIN,
  veredictoAutotuning,
} from '../src/lib/sim/pace'

describe('autotuning-balance · banda y muestra mínima', () => {
  test('constantes del contrato: banda [0.4, 0.6] inclusiva y muestra 5', () => {
    expect(AUTOTUNING_TASA_MIN).toBe(0.4)
    expect(AUTOTUNING_TASA_MAX).toBe(0.6)
    expect(AUTOTUNING_MUESTRA_MIN).toBe(5)
  })

  test('sin finalizadas → SIN_DATOS con tasas null (no «0 %» de tasa)', () => {
    const v = veredictoAutotuning({ total: 0, red: 0, blue: 0, empate: 0 })
    expect(v.estado).toBe('SIN_DATOS')
    expect(v.finalizadas).toBe(0)
    expect(v.tasaRed).toBeNull()
    expect(v.enBanda).toBeNull()
    expect(v.tasaEmpate).toBe(0)
  })

  test('muestra corta publica la tasa como información sin veredicto pleno', () => {
    // 2 campañas, 1 RED: tasa 0.5 estaría EN banda, pero 2 < 5.
    const v = veredictoAutotuning({ total: 2, red: 1, blue: 1, empate: 0 })
    expect(v.estado).toBe('MUESTRA_CORTA')
    expect(v.tasaRed).toBe(0.5)
    expect(v.enBanda).toBe(true) // informativo, no veredicto
    expect(v.finalizadas).toBe(2)
  })

  test('borde inferior inclusivo: 40 % exacto es EQUILIBRIO', () => {
    // 5 campañas: 2 RED, 2 BLUE, 1 empate → tasaRed 0.4.
    const v = veredictoAutotuning({ total: 5, red: 2, blue: 2, empate: 1 })
    expect(v.estado).toBe('EQUILIBRIO')
    expect(v.tasaRed).toBe(0.4)
    expect(v.enBanda).toBe(true)
    expect(v.tasaEmpate).toBe(0.2)
  })

  test('borde superior inclusivo: 60 % exacto es EQUILIBRIO', () => {
    // 5 campañas: 3 RED, 2 BLUE → tasaRed 0.6.
    const v = veredictoAutotuning({ total: 5, red: 3, blue: 2, empate: 0 })
    expect(v.estado).toBe('EQUILIBRIO')
    expect(v.tasaRed).toBe(0.6)
  })

  test('el borde manda: 6/10 sigue en banda, 6/9 y 3/9 caen fuera', () => {
    // 10 campañas, 6 RED → 0.6: SIGUE en banda (borde).
    expect(veredictoAutotuning({ total: 10, red: 6, blue: 4, empate: 0 }).estado).toBe('EQUILIBRIO')
    // 9 campañas, 6 RED → 0.666…: fuera por arriba.
    expect(veredictoAutotuning({ total: 9, red: 6, blue: 3, empate: 0 }).estado).toBe('TASA_ALTA')
    // 9 campañas, 3 RED → 0.333…: fuera por abajo.
    expect(veredictoAutotuning({ total: 9, red: 3, blue: 6, empate: 0 }).estado).toBe('TASA_BAJA')
  })

  test('los empates pesan en el denominador y exponen la señal de H-003', () => {
    // 5 campañas: 1 RED, 0 BLUE, 4 EMPATE → tasaRed 0.2 (TASA_BAJA) y
    // tasaEmpate 0.8 visible — el empate NO se esconde del veredicto.
    const v = veredictoAutotuning({ total: 5, red: 1, blue: 0, empate: 4 })
    expect(v.estado).toBe('TASA_BAJA')
    expect(v.tasaRed).toBe(0.2)
    expect(v.tasaEmpate).toBe(0.8)
    expect(v.enBanda).toBe(false)
  })

  test('todas empate (H-003) → TASA_BAJA con tasaEmpate 1, no SIN_DATOS ni EQUILIBRIO', () => {
    const v = veredictoAutotuning({ total: 5, red: 0, blue: 0, empate: 5 })
    expect(v.estado).toBe('TASA_BAJA')
    expect(v.tasaRed).toBe(0)
    expect(v.tasaEmpate).toBe(1)
    expect(v.enBanda).toBe(false)
  })

  test('muestraMin configurable (el script global agrupa por encima del mínimo)', () => {
    const cifras = { total: 3, red: 1, blue: 2, empate: 0 }
    expect(veredictoAutotuning(cifras).estado).toBe('MUESTRA_CORTA')
    expect(veredictoAutotuning(cifras, { muestraMin: 3 }).estado).toBe('TASA_BAJA')
    expect(veredictoAutotuning(cifras, { muestraMin: 1 }).estado).toBe('TASA_BAJA')
  })

  test('el global agrupa escenarios con signos opuestos (la compensación se ve)', () => {
    // Escenario A: RED domina (5/5). Escenario B: BLUE domina (0/5).
    // El global 5/10 = 0.5 está EN banda — el agregado solo no basta:
    // por eso el script reporta POR ESCENARIO y global.
    const a = { total: 5, red: 5, blue: 0, empate: 0 }
    const b = { total: 5, red: 0, blue: 5, empate: 0 }
    expect(veredictoAutotuning(a).estado).toBe('TASA_ALTA')
    expect(veredictoAutotuning(b).estado).toBe('TASA_BAJA')
    const global = {
      total: a.total + b.total,
      red: a.red + b.red,
      blue: a.blue + b.blue,
      empate: a.empate + b.empate,
    }
    const vg = veredictoAutotuning(global)
    expect(vg.tasaRed).toBe(0.5)
    expect(vg.estado).toBe('EQUILIBRIO')
  })
})
