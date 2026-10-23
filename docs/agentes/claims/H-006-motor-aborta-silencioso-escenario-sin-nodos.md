# Claim: H-006-motor-aborta-silencioso-escenario-sin-nodos

- ID: IMP-1
- Fecha/hora: 2026-10-23 14:02 (Europe/Madrid)
- Rutas: src/lib/sim/engine-select.ts (parsearInfraestructura + elegirEscenarioLanzable,
  catálogo en resolverEscenario), src/lib/sim/engine.ts (integración en startCampaign +
  capa defensiva en runCampaign), src/app/api/campaigns/route.ts (400/503 clasificados),
  tests/infraestructura-lanzable.test.ts (nuevo), tests/dificultad-adaptativa.test.ts
  (infraestructura válida — dependía del fallo que este hallazgo corrige),
  docs/agentes/hallazgos/H-006-motor-aborta-silencioso-escenario-sin-nodos.md,
  docs/agentes/estado/IMP-1.md

H-006 (persona #1 administrador/operador, prioridad DIR 13ª pasada): el motor
aceptaba el lanzamiento de un escenario con infrastructure sin nodos (BD
importada de otra versión o editada a mano) — 200 aparente y campaña ABORTED
en silencio ~2 s después (nodes[…].id sobre undefined, causa solo en el log
del servidor). Cierre: validación de la infraestructura ANTES del create con
errores clasificados (400 si el id pedido existe pero no es lanzable, 503 si
no queda ninguno), exclusión de los no lanzables del azar explícito, y capa
defensiva en runCampaign con registro legible.
