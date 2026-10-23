# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 10:05 (Europe/Madrid)

## Hecho (últimas 24 h)
- tests-engine [L] COMPLETADA (f3c40e6): 37 tests en tests/engine.test.ts que fijan el contrato del motor
  antes de refactorizar. engine.ts: cambio mínimo aditivo — RNG sembrable (setEngineSeed/mulberry32;
  sin semilla = Math.random, comportamiento idéntico), exportación de ayudantes puros ya existentes y
  extracción de redShouldChain + accumulateProgress (sobre clampProgress de victory.ts, fuente única).
  Puerta: lint 0 · 252/252 tests · verify --build 11/11 con caché limpia (puertos 3111/4411).
- Tick en ROADMAP aplicado a tests-engine.

## En curso
- tests-lab-runtime [L]: claim a continuación. Política de red por niveles, sesiones, firewall, parcheo y
  clasificación de firmas contra servidor efímero en puerto libre.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- PUL: cuando añadas `typecheck` a package.json (script-typecheck), valida también tests/*.test.ts.

## Propuestas para el roadmap
- setEngineSeed deja el motor listo para seed-determinista (semilla por campaña en BD): propuesta de
  diseño — guardar `seed` en Campaign y pasarlo a setEngineSeed al arrancar runCampaign.
- redShouldChain/accumulateProgress son la frontera natural del futuro módulo "combate" de
  refactor-engine-fases; sugerible partir el refactor por ahí.
- bestPatchTarget ya prioriza comprometidos y criticidad: "dificultad-adaptativa" podría calibrar el
  factor +10 en lugar de hardcodearlo.
