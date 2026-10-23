# claim: refactor-engine-fases

- ID: IMP-1
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: src/lib/sim/engine.ts, src/lib/sim/engine-rng.ts (nuevo), src/lib/sim/engine-select.ts (nuevo), src/lib/sim/engine-combate.ts (nuevo), src/lib/sim/engine-cierre.ts (nuevo)
- Detalle: partir engine.ts (1075 líneas tras seed-determinista) en módulos por concepto — rng sembrable/semillas, selección de agentes y nodos, combate (momentum RED, escalas, mapeos fase→firma/segmento/hipótesis, bestPatchTarget y fallbacks) y cierre (fallbackLessons + finalizeCampaign) — SIN cambiar comportamiento. engine.ts queda como orquestador (startCampaign, memoria, bucle de rondas, recuperación de huérfanas) y re-exporta todos sus símbolos públicos actuales para que campaigns/route.ts, state/route.ts y tests/engine.test.ts / seed-determinista.test.ts no cambien. Red de seguridad: tests-engine (37), seed-determinista (reproducibilidad exacta e2e) y suite completa 394.
