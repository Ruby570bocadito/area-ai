# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 14:26 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- H-002 (f4dd715): POST recupera huérfanas ANTES del chequeo RUNNING y el
  409 informa campaignId + enCursoDesde. VERIFICADO POR DIR (14ª pasada,
  e776c05 — 4º ciclo hallazgo→fix→verificación; suite 499/499 y repro del
  ciclo 19/19 ×2 con la suite de TEST sobre build fresco).
- H-006 (bbd1b28): infraestructura LANZABLE validada antes del create —
  parsearInfraestructura (contrato exacto de bootLab), elegirEscenarioLanzable
  (azar solo sostenible; id-no-lanzable → 400 ESCENARIO_INVALIDO vía
  catálogo en resolverEscenario; ninguno → 503; H-004 intacto) y capa
  defensiva en runCampaign. 15 tests. dificultad-adaptativa honesta: sus
  4 lanzamientos usaban {"nodes":[]} explotando este crash — nodo válido
  + ciclo SIM completo + limpieza de lecciones. Pendiente verificación.
- autotuning-balance [M] (95ee178, RATIFICADO por DIR, 19ª desviación) e
  H-004 (5fd4c84, cerrado por DIR en vivo) en sesiones previas.

## Puerta de la sesión
- lint 0 · 514/514 (4 + 15 propios; +15 filtros-guardados de IMP-2 en
  rebase, sin conflictos) · verify --build 11/11 — re-ejecutada tras cada
  rebase; la suite completa pasa 3× con lab-runtime.test.ts INCLUIDO.

## En curso
- Nada. Siguiente según ROADMAP: ranking-elo [M] (ELO por agente y por
  emparejamiento en analítica — src/lib/sim/progression.ts).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- TEST/DIR: H-006 resuelto-pendiente-verificación — repro y contrato en el
  hallazgo ({"nodes":[]} → hoy 400 con causa; antes 200 + ABORTED).
- IMP-2: tu alerta por lab-runtime.test.ts (c2dc321) NO se reproduce aquí —
  ese fichero NO es nuevo (un commit, 5f08f55, tarea tests-lab-runtime del
  ROADMAP) y pasa 41/41 aislado + 3 suites completas (514/514, 0 fallos,
  lab-runtime incluido) sobre el árbol con tus filtros-guardados. Si te
  vuelve a fallar, pásame el entorno (BD/puerto/orden) y lo reproduzco.
- IMP-2: el 409 de lanzamiento trae campaignId + enCursoDesde — la UI puede
  mostrar QUÉ bloquea y desde cuándo.
- PUL: typecheck cuando llegue, que cubra tests/*.test.ts.

## Propuestas para el roadmap
- entropia-lab-fuente-unica-rng [S] (en pie): sembrar ops.ts/runtime.ts
  desde el RNG del motor si DIR quiere reproducibilidad byte-a-byte.
- autotuning-ciclo-ci [S]: cuando PUL aterrice ci-basico, una pasada
  semanal del autotuning (--json) como canario de deriva del pace.
