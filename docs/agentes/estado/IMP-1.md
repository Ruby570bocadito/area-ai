# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 10:55 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- tests-engine [L] COMPLETADA (f3c40e6): 37 tests del motor con RNG sembrado; desbloquea refactor-engine-fases.
- tests-lab-runtime [L] COMPLETADA (5f08f55): 41 tests contra el servidor HTTP real del lab + fix en ops.ts
  (redIntrusion leía las vulns del InfraNode estático en vez del estado vivo del lab; regresión incluida).
- tests-progresion-conocimiento [M] COMPLETADA (7000c25): 21 tests — curva de XP, fórmula 60/30/10,
  provider-config (maskKey, prioridad BD→env→zai, caché TTL).
- balance-datos-archivo [S] COMPLETADA: veredicto de deriva D30 con el archivo, coste cero en LLM.
  Módulo puro src/lib/sim/balance-drift.ts (umbral ≥70 % del mismo ganador en 15+ archivadas abre
  recalibración formal de pace.ts; el EMPATE también es candidato — H-003), script SOLO LECTURA
  scripts/balance-drift.mjs (--json/--dias, salida 0/1) y 19 tests (frontera exacta 21/30=70 %,
  ventana D30 inclusiva, clamp de progreso, desglose por escenario y por modo LLM/SIM).
  Probado end-to-end con datos efímeros en BD local (DERIVA_RED 94,4 % detectado; limpieza verificada).

## Puerta de la sesión
- lint 0 errores · 354/354 tests · verify --build 11/11.

## En curso
- Nada. Siguiente según ROADMAP: idempotencia-lanzamiento [S] (dedupe servidor de POST /api/campaigns).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- TEST: el veredicto de H-003 (todas empate) lo emite ahora scripts/balance-drift.mjs cuando el archivo
  alcance 15 archivadas en D30 — el umbral de deriva coincide con el criterio del hallazgo.
- SEG: security-verify podría incluir un caso de traversal codificado (..%2f), variante que llega al
  clasificador del lab (petición de la sesión anterior, sigue abierta).
- PUL: cuando añadas `typecheck` a package.json, que cubra también tests/*.test.ts.

## Propuestas para el roadmap
- seed-determinista ya tiene la mitad del camino: guardar `seed` en Campaign y pasarlo a setEngineSeed.
- El desglose porModo del veredicto distingue deriva solo-SIM (apunta a pace.ts) de solo-LLM (apunta a
  las decisiones del proveedor) — útil para dificultad-adaptativa y autotuning-balance.
