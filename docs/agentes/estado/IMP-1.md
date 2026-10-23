# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 14:18 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- H-006 (bbd1b28, prioridad persona #1 — DIR 13ª): el motor ya NO acepta
  escenarios con infraestructura no utilizable — parsearInfraestructura
  (puro, engine-select) valida el contrato EXACTO que bootLab
  desreferencia (id, type, segment, criticality, vulnerabilities,
  controls); elegirEscenarioLanzable en startCampaign ANTES del create:
  azar solo sobre sostenibles, id existente-no-lanzable → 400
  ESCENARIO_INVALIDO (resolverEscenario gana catálogo — «inexistente»
  era diagnóstico falso), id inexistente → SCENARIO_NOT_FOUND intacto,
  ninguno lanzable → 503 SIN_ESCENARIOS_VALIDOS; capa defensiva en
  runCampaign (BD editada entre create y bucle → registro clasificado).
  15 tests. dificultad-adaptativa honesta: sus 4 lanzamientos reales
  usaban {"nodes":[]} explotando este crash — nodo válido + ciclo SIM
  completo + limpieza de lecciones.
- H-002 (f4dd715, misma prioridad): el POST recupera huérfanas ANTES del
  chequeo RUNNING (viva solo en GET /api/state — cliente solo-POST
  recibía 409 indefinido tras reiniciar) y el 409 INFORMA: campaignId +
  enCursoDesde ISO. Idempotente, umbral 120 s intacto, vivas intactas.
  4 tests con lanzamiento REAL en SIM (aislamiento SDK, molde
  dificultad-adaptativa; semillas distintas por POST — ventana dedupe).
- autotuning-balance [M] (95ee178, sesión previa, RATIFICADO por DIR como
  19ª desviación) e H-004 casos 1-2 (5fd4c84, CERRADO por DIR en vivo).

## Puerta de la sesión
- lint 0 · 514/514 tests (4 + 15 nuevos; llegaron 15 de filtros-guardados
  de IMP-2 en rebase, sin conflictos) · verify --build 11/11 —
  re-ejecutada tras cada rebase.

## En curso
- Nada. Siguiente según ROADMAP: ranking-elo [M] (ELO por agente y por
  emparejamiento en analítica — src/lib/sim/progression.ts).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- TEST: H-002 y H-006 quedan resuelto-pendiente-verificación — repro y
  contrato documentados en cada hallazgo; el ciclo de reinicio-servidor
  de e2e debería hoy cerrar solo (POST ya recupera huérfanas).
- IMP-2: el 409 de lanzamiento ahora trae campaignId y enCursoDesde —
  la UI puede mostrar QUÉ bloquea y desde cuándo si le interesa.
- PUL: typecheck cuando llegue, que cubra tests/*.test.ts.

## Propuestas para el roadmap
- entropia-lab-fuente-unica-rng [S] (en pie): sembrar ops.ts/runtime.ts
  desde el RNG del motor si DIR quiere reproducibilidad byte-a-byte.
- autotuning-ciclo-ci [S]: cuando PUL aterrice ci-basico, una pasada
  semanal del autotuning (--json) como canario de deriva del pace.
