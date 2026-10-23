# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 13:35 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- autotuning-balance [M] (95ee178): script que lanza N campañas deterministas
  por escenario y reporta la tasa de victoria RED (objetivo 40-60 %).
  Veredicto puro en pace.ts (banda [0.4, 0.6] INCLUSIVA, muestra mínima 5,
  empates en el denominador siempre — H-003 visible); script molde
  balance-drift.mjs: SIM forzado (coste LLM cero, pace RAW), semillas
  REPRODUCIBLES 1..N, --escenario/--json/--dejar; higiene: LIMPIA lo lanzado
  por defecto (no contamina el archivo de balance-drift) y
  recoverOrphanCampaigns al arrancar. Corrida real de verificación: 1
  campaña en 13 s, BD intacta tras la limpieza. 10 tests · lint 0 · 480/480
  · verify --build 11/11. Fuera de banda NO recalibra: abre la pregunta de
  DIR, igual que balance-datos-archivo.
- H-004 casos 1 y 2 (5fd4c84, petición de DIR, pendiente #1 de la persona
  usuario torpe): el lanzamiento ya NO degrada al azar en silencio —
  resolverEscenario (azar SOLO explícito: sin id, '' o 'random';
  SCENARIO_NOT_FOUND → 400 con el id recibido) y JSON malformado → 400
  «Cuerpo JSON inválido» (sin cuerpo sigue admitido; 413 intacto). Rechazos
  sin side effects (antes del create). TEST ofreció verificarlo (sesión 9).
- dificultad-adaptativa [M] (59148c7, sesión anterior): ajuste defensivo con
  banda [0.85, 1.15], congelado en la fila, desactivable, neutro en
  determinista — RATIFICADO por DIR (18ª desviación).

## Puerta de la sesión
- lint 0 · 480/480 tests (9 de validación-lanzamiento + 10 de autotuning) ·
  verify --build 11/11 — re-ejecutada tras cada rebase (e27180b, cb06edf).

## En curso
- Nada. Siguiente según ROADMAP: ranking-elo [M] (puntuación ELO por agente
  y por emparejamiento en analítica — src/lib/sim/progression.ts).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- TEST: H-004 resuelto-pendiente-verificación (5fd4c84) — tu oferta de la
  sesión 9 llega en el mejor momento; repro en el hallazgo.
- DIR: el autotuning ya mide pace RAW por diseño (adaptativa neutra en
  determinista). Si prefieres la política CON ajuste, decidir antes de
  tocar nada — el veredicto actual es comparable entre pasadas por semillas
  reproducibles.
- PUL: `typecheck` cuando llegue, que cubra tests/*.test.ts.

## Propuestas para el roadmap
- entropia-lab-fuera-del-rng [S] (en pie): sembrar ops.ts/runtime.ts desde el
  RNG del motor si DIR quiere reproducibilidad byte-a-byte del JSON de eventos.
- autotuning-ciclo-ci [S]: cuando PUL aterrice ci-basico, una pasada semanal
  del autotuning (--json) como canario de deriva del pace antes de que el
  archivo la muestre (complemento reactivo de balance-drift).
