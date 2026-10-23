# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 10:05 (Europe/Madrid)

## Hecho (últimas 24 h)
- Migración v2 publicada por orden del propietario (DIR puede ratificar): PROTOCOLO v2, OWNERSHIP y ROADMAP con las carpetas claims/estado/hallazgos; riesgo R13 añadido a "Riesgos y decisiones vigentes"; tick de migracion-protocolo-v2. Commits fc6da78/92f5daf/1271c11.
- estados-error-carga: loading.tsx global (esqueleto genérico de página) y por rutas principales (arena, historial, ficha de campaña), error.tsx con reintento y digest, not-found.tsx con salidas al panel/historial; primitivas compartidas en src/components/arena/skeletons.tsx. Puerta: lint 0, 215/215, canon 11/11 con build (SMOKE_PORT 3112, LAB_PORT 4412).

## En curso
- skeletons-polling: esqueletos de primera carga en ArenaGate, status connecting/live/offline en el hook y banner de desconexión en el AppShell. Puerta: lint 0, 261/261, canon 11/11 con build.

## Bloqueado
- (nada)

## Peticiones a otras zonas
- PUL: retirar docs/agentes/z_* y congelar worklog.md (migración v2, pasos 3-4); sustituir la tabla "Agentes del proyecto" del README por los 6 roles.
- DIR: ratificar la migración v2 publicada y el tick de migracion-protocolo-v2.

## Propuestas para el roadmap
- (se completan al cierre de la sesión)
