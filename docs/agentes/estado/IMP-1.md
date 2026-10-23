# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 11:30 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- tests-engine [L] (f3c40e6) · tests-lab-runtime [L] (5f08f55, con fix de ops.ts) ·
  tests-progresion-conocimiento [M] (7000c25) — red de seguridad completa del motor.
- balance-datos-archivo [S] COMPLETADA (36240a6): veredicto de deriva D30 con el archivo,
  coste cero en LLM. Módulo puro balance-drift.ts (umbral ≥70 % del mismo ganador en 15+
  archivadas abre recalibración de pace.ts; el EMPATE también es candidato — H-003), script
  SOLO LECTURA scripts/balance-drift.mjs (--json/--dias), 19 tests. Probado end-to-end con
  datos efímeros (DERIVA_RED 94,4 % detectado; limpieza verificada).
- idempotencia-lanzamiento [S] COMPLETADA: hipótesis [verificar] CONFIRMADA con repro
  (6 POST concurrentes → 2 campañas RUNNING simultáneas, TOCTOU findFirst→create en
  startCampaign). Cierre en dos piezas: (1) cerrojo launch-lock.ts en el motor — el
  check+create se serializa, el segundo concurrente ya ve la RUNNING y cae en 409;
  (2) dedupe en la ruta — Idempotency-Key con replay de 10 min + hash de cuerpo en
  ventana de 5 s (escala del doble clic), solo 200 archivados, memoria acotada, replay
  sin consumir cuota de rate-limit. Repro post-fix: 6 POST concurrentes → 1 campaña y
  5×409; misma key tras terminar la campaña → mismo campaignId con Idempotency-Replay.

## Puerta de la sesión
- lint 0 errores · 366/366 tests · verify --build 11/11.

## En curso
- Nada. Siguiente según ROADMAP: seed-determinista [M] (setEngineSeed listo desde tests-engine).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- TEST: el dedupe por cuerpo (5 s) devuelve el mismo campaignId en el doble clic — los e2e
  que lanzan dos campañas seguidas con el mismo cuerpo deben esperar >5 s o usar keys distintas.
- IMP-2: si el botón «Lanzar» puede enviar Idempotency-Key (crypto.randomUUID al armar la
  petición), el replay de 10 min cubre también el reintento tras timeout de red.
- SEG: security-verify podría incluir un caso de traversal codificado (..%2f) (abierta desde
  la sesión anterior). El dedupe archiva solo 200: un 401/429 nunca se reproduce.
- PUL: cuando añadas `typecheck`, que cubra también tests/*.test.ts.

## Propuestas para el roadmap
- seed-determinista ya tiene la mitad del camino: guardar `seed` en Campaign y pasarlo a
  setEngineSeed al arrancar runCampaign.
- El desglose porModo de balance-drift distingue deriva solo-SIM (apunta a pace.ts) de
  solo-LLM (apunta al proveedor) — útil para dificultad-adaptativa y autotuning-balance.
