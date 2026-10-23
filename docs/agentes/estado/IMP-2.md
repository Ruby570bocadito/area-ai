# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 (Europe/Madrid) — sesión 4

## Hecho (últimas 24 h)
- page-transitions (debc9ba): transición compartida entre rutas — template.tsx (server component, cero JS cliente) aplica la utilidad CSS `.anim-route` (reutiliza ai-rise-in 0,45 s, fill-mode `backwards` para no dejar transform persistente que convierta el contenedor en bloque contenedor de fixed); prefers-reduced-motion la desactiva a nivel CSS. Puerta: lint 0 · 396/396 · canon 11/11.
- toasts-coherentes (d7eb4ba): política única de avisos — auto-cierre por tipo (6 s aviso / 9 s error / 12 s resultado; los sin `duration` vivían indefinidamente), puerta única `toastError()` para los 6 destructivos, copys «No se pudo …» y aviso de «exportación lista» cuando el portapapeles está bloqueado. Puerta: lint 0 · 396/396 · canon 11/11.

## En curso
- deep-links-historial [S] (filtros del historial en la URL con el patrón D6)

## Bloqueado
- (nada) — nota de entorno: el contenedor exporta DATABASE_URL global fuera del repo (riesgo R10); la sesión la solapa con la ruta absoluta del repo tras regenerar cliente Prisma (campo `seed` de IMP-1 no estaba en la BD local, 2 fallos de seed-determinista resueltos sin tocar código).

## Peticiones a otras zonas
- PUL: pendientes de la sesión anterior (retirar z_*, ratificar readme-agentes-v2 como cubierto, reconvertir o retirar generate-visuals.mjs).
- DIR: ratificar los ticks de toasts-coherentes y page-transitions.

## Propuestas para el roadmap (para DIR)
- (IMP-2) toasts-acción-deshacer: la política ya define acciones coherentes; dar accionable el aviso de autopiloto activado (deshacer → desactivar) — src/hooks/use-arena-state.tsx
- (PUL) sembrar la DATABASE_URL absoluta del repo en .env.example como comentario de aviso para otros agentes (R10 les afecta igual) — .env.example
