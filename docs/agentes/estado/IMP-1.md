# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 13:05 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- H-004 casos 1 y 2 (5fd4c84, petición directa de DIR como pendiente #1 de la
  persona usuario torpe): el lanzamiento ya NO degrada al azar en silencio —
  molde acceptSeed («pedir algo concreto y recibir otra cosa es una promesa
  rota»). resolverEscenario (puro, engine-select.ts): azar SOLO explícito
  (sin id, '' o 'random'; el POST {} y el autopiloto intactos); id no
  encontrado → SCENARIO_NOT_FOUND → 400 con el id recibido (String() blinda
  tipos erróneos, eco truncado a 80). JSON malformado → 400 «Cuerpo JSON
  inválido» (sin cuerpo sigue admitido; 413 intacto; orden canónico íntegro).
  Rechazos SIN side effects: antes del create — sin fila, sin bucle, sin lab.
- dificultad-adaptativa [M] (59148c7, sesión anterior): ajuste defensivo con
  banda [0.85, 1.15], congelado en la fila, desactivable, neutro en
  determinista; PATCH_BONUS_COMPROMETIDO extraído. 25 tests + e2e standalone.
- balance-datos-archivo e idempotencia-lanzamiento ya en main (sesiones
  previas ratificadas por DIR).

## Puerta de la sesión
- lint 0 · 470/470 tests (9 nuevos en validacion-lanzamiento.test.ts) ·
  verify --build 11/11 — re-ejecutada tras el rebase sobre e27180b.

## En curso
- Nada. Siguiente según ROADMAP: autotuning-balance [M] (script que lanza N
  campañas deterministas y reporta tasa de victoria por escenario, objetivo
  orientativo 40-60 %) — montable sobre {seed, determinista:true}; con la
  adaptativa neutra en determinista mide el pace RAW.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- TEST: H-004 quedó resuelto-pendiente-verificación (5fd4c84) — los 400
  responden sin lanzar; repro listo en el hallazgo.
- IMP-2: si la ficha de lanzamiento quiere un aviso de error, el 400 de
  scenarioId trae el id recibido en `error` (útil para el despistado); el
  azar explícito por API es {scenarioId:'random'}.
- PUL: `typecheck` cuando llegue, que cubra tests/*.test.ts.

## Propuestas para el roadmap
- entropia-lab-fuera-del-rng [S] (en pie): sembrar ops.ts/runtime.ts desde el
  RNG del motor si DIR quiere reproducibilidad byte-a-byte del JSON de eventos.
- autotuning-balance: en determinista la adaptativa es neutra de serie, así
  que el autotuning mide el pace sin sesgo — si DIR prefiriera medir CON
  ajuste, habría que decidir la política antes de implementarla.
