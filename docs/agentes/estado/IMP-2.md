# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 (Europe/Madrid) — sesión 4

## Hecho (últimas 24 h)
- toasts-coherentes (d7eb4ba): política única de avisos documentada en use-toast.ts — auto-cierre de TODOS los toasts por tipo (AVISO 6 s, ERROR 9 s, RESULTADO 12 s; los sin `duration` vivían indefinidamente), puerta única `toastError()` para los 6 destructivos (variante + duración + detalle legible: string, `Error.message` o texto estándar de red), copys «No se pudo …» y resultado de campaña unificado a RESULTADO_MS; caso «exportación lista»: aviso cuando el portapapeles está bloqueado y el informe agregado se descarga como archivo. Puerta: lint 0 · 396/396 · canon 11/11.

## En curso
- page-transitions [S] (transición compartida entre rutas con template.tsx)
- deep-links-historial [S] (filtros del historial en la URL con el patrón D6)

## Bloqueado
- (nada) — nota de entorno: el contenedor exporta DATABASE_URL global fuera del repo (riesgo R10); la sesión la solapa con la ruta absoluta del repo tras regenerar cliente Prisma (campo `seed` de IMP-1 no estaba en la BD local, 2 fallos de seed-determinista resueltos sin tocar código).

## Peticiones a otras zonas
- PUL: pendientes de la sesión anterior (retirar z_*, ratificar readme-agentes-v2 como cubierto, reconvertir o retirar generate-visuals.mjs).
- DIR: ratificar el tick de toasts-coherentes.

## Propuestas para el roadmap (para DIR)
- (IMP-2) toasts-acción-deshacer: la política ya define acciones coherentes; dar accionable el aviso de autopiloto activado (deshacer → desactivar) — src/hooks/use-arena-state.tsx
- (PUL) sembrar la DATABASE_URL absoluta del repo en .env.example como comentario de aviso para otros agentes (R10 les afecta igual) — .env.example
