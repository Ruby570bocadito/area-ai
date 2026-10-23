# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 10:45 (Europe/Madrid)

## Hecho (últimas 24 h)
- Migración v2 publicada por orden del propietario (DIR puede ratificar): PROTOCOLO v2 + OWNERSHIP + ROADMAP con claims/estado/hallazgos; riesgo R13 incorporado a "Riesgos y decisiones vigentes"; tick de migracion-protocolo-v2.
- estados-error-carga: loading.tsx global + rutas principales (arena/historial/ficha), error.tsx con reintento y not-found.tsx; primitivas en components/arena/skeletons.tsx.
- skeletons-polling: status connecting/live/offline en use-arena-state (offline con 2 fallos seguidos); ArenaGate con esqueleto de página y tarjeta de reintento; banner de desconexión persistente en AppShell.
- reduced-motion: MotionConfig reducedMotion="user" en AppShell; bloque CSS ampliado (.anim-rise y transiciones decorativas); NumberFlow verificado en node_modules (respectMotionPreference=true por defecto).
- confirmacion-lanzamiento: diálogo de confirmación ligera antes del POST, conservando el lock starting de doble clic.
- estados-vacios: EmptyState (variante full/compact) con CTA de siguiente paso en historial (2), conocimiento (2), analítica (3) y ficha de agente (1).
- Puerta en cada tarea: lint 0 errores, 266/266 tests, canon verify --build 11/11 (SMOKE_PORT 3112, LAB_PORT 4412, DATABASE_URL absoluta; caché limpia en reduced-motion por D27).

## En curso
- (nada — sesión cerrada tras 5 tareas de zona)

## Bloqueado
- (nada)

## Peticiones a otras zonas
- PUL: retirar docs/agentes/z_* y congelar worklog.md (migración v2, pasos 3-4); tabla "Agentes del proyecto" del README con los 6 roles (el .agent-tmp/ de .gitignore ya lo añadió IMP-2 en la migración).
- DIR: ratificar la migración v2 publicada y los ticks; valorar las propuestas de abajo.

## Propuestas para el roadmap (para DIR)
- (IMP-2) page-transitions — transición compartida entre rutas con template.tsx; ahora es barato tras reduced-motion (MotionConfig ya envuelve todo) — src/app/
- (IMP-2) barra-estado-sistema — la tarea existente P1 puede apoyarse en el status connecting/live/offline ya expuesto por use-arena-state — src/components/arena/shell/
- (IMP-2) estados-vacios-e2e — TEST: cubrir con e2e el banner de desconexión, la tarjeta de reintento y los EmptyState (persona "usuario torpe" con servidor parado) — tests/e2e/
- (DIR) idea: deep-links de filtros del historial en la URL (patrón D6 ya existente en analítica) antes de "filtros-guardados" con persistencia local — src/components/arena/history-panel.tsx
