# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 12:45 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- Red de seguridad del motor COMPLETA: tests-engine [L] (f3c40e6, 37 tests),
  tests-lab-runtime [L] (5f08f55, 41 tests + fix de ops.ts),
  tests-progresion-conocimiento [M] (7000c25, 21 tests).
- balance-datos-archivo [S] (36240a6): veredicto de deriva D30 coste cero — módulo puro
  balance-drift.ts (≥70 % del mismo ganador en 15+ archivadas abre recalibración de
  pace.ts; EMPATE incluido como candidato, H-003) + script SOLO LECTURA
  scripts/balance-drift.mjs (--json/--dias) + 19 tests de frontera.
- idempotencia-lanzamiento [S] (8ec02ee): [verificar] CONFIRMADO (6 POST concurrentes →
  2 campañas RUNNING, TOCTOU). Cierre doble: launch-lock.ts serializa check+create en el
  motor (post-fix: 1 campaña y 5×409) y dedupe en la ruta (Idempotency-Key replay 10 min
  + hash de cuerpo 5 s, solo 200 archivados, replay sin consumir rate-limit). Conflicto
  del ROADMAP con TEST resuelto leyendo ficheros completos (sin regex).
- seed-determinista [M]: Campaign.seed Int? + Campaign.determinista Boolean (db:push sin
  pérdida); RNG sembrado ANTES de elegir escenario y re-sembrado en runCampaign desde la
  fila; POST {seed, determinista} con 400 si inválidos (H-004); determinista fuerza SIM
  sin sonda. VERIFICADO e2e: dos campañas seed 2026 determinista → 31 eventos idénticos
  y mismo desenlace (RED 62/BLUE 72, EMPATE). Hallazgo del camino: sin determinista la
  primera verificación divergió — escenario elegido antes de sembrar (corregido) y LLM
  no reproducible (ahora documentado en el esquema: solo SIM garantiza exactitud).

## Puerta de la sesión
- lint 0 errores · 394/394 tests · verify --build 11/11 (tsc incluido).

## En curso
- Nada. Siguiente según ROADMAP: refactor-engine-fases [L] (red de seguridad lista) —
  partir en piezas funcionales, frontera natural redShouldChain/accumulateProgress.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- IMP-2: el botón «Lanzar» puede enviar {determinista:true, seed} y guardar la semilla
  devuelta para ofrecer «reproducir campaña» (mismo POST con la semilla archivada).
- TEST: el smoke/e2e que comprueba el arranque de campañas ahora puede fijar seed y
  determinista para corridas comparables; validaciones nuevas devuelven 400 (semilla/
  determinista mal tipados).
- SEG: nada nuevo; el dedupe solo archiva 200 y el orden de barreras del POST no cambia
  (403→401→413→400 de semilla→429).
- PUL: `typecheck` cuando llegue que cubra tests/*.test.ts.

## Propuestas para el roadmap
- autotuning-balance puede montarse YA sobre {seed, determinista:true}: N campañas
  idénticas-comparables por escenario, cero coste LLM, tasa de victoria exacta.
- refactor-engine-fases: partir primero el módulo «combate» (redShouldChain +
  accumulateProgress ya exportados y testados) y luego selección/rondas/cierre.
- La semilla abarca la elección de escenario: «reproducir campaña X» = POST {seed de X,
  determinista:true} sin pasar scenarioId (la semilla la re-elige).
