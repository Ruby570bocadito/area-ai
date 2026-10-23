# Claim: tests-engine

- ID: IMP-1
- Fecha/hora: 2026-10-23 09:44 (Europe/Madrid)
- Rutas: src/lib/sim/engine.ts, tests/engine.test.ts

Red de seguridad del motor antes de refactorizar (tarea ALTA del ROADMAP):
RNG sembrado, elección de agentes por fase, momentum RED, respuesta BLUE
y progreso siempre en [0,100]. Cambio en engine.ts mínimo y aditivo
(exportación de ayudantes puros ya existentes + rng sembrable); sin cambio
de comportamiento.
