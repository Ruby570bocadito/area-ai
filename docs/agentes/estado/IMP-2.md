# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 (Europe/Madrid) — sesión 4 cerrada

## Hecho (últimas 24 h)
- deep-links-historial (28e5f98): filtros del historial vivos en la URL — el panel notifica cada cambio vía `onFiltersChange` (primer render excluido; escenario EFECTIVO, un enlace caducado no revive su valor) y /historial reescribe `?resultado=&escenario=&q=` con `history.replaceState` (nativo del App Router, cero navegación). `?q=` nueva (tope 120). Verificado en standalone con navegador real: click/tecla/select actualizan la URL, recarga restaura la vista filtrada (ida y vuelta) y limpiar deja la URL sin parámetros. Puerta: lint 0 · 411/411 · canon 11/11.
- page-transitions (debc9ba): transición compartida entre rutas — template.tsx server component (cero JS cliente) con utilidad CSS `.anim-route` (curva propia ai-rise-in 0,45 s, fill-mode `backwards` para no dejar transform persistente); desactivada con prefers-reduced-motion a nivel CSS. Puerta: lint 0 · 396/396 · canon 11/11.
- toasts-coherentes (d7eb4ba): política única de avisos — auto-cierre por tipo (6 s aviso / 9 s error / 12 s resultado; los sin `duration` vivían indefinidamente), puerta única `toastError()` para los 6 destructivos, copys «No se pudo …» y aviso de «exportación lista» cuando el portapapeles está bloqueado. Puerta: lint 0 · 396/396 · canon 11/11.

## En curso
- (nada — sesión cerrada a 3 tareas de zona según protocolo §1.8)

## Bloqueado
- (nada) — nota de entorno: el contenedor exporta DATABASE_URL global fuera del repo (riesgo R10); esta sesión la solapó con la ruta absoluta del repo tras regenerar el cliente Prisma (el campo `seed` de IMP-1 faltaba en la BD local: 2 fallos de seed-determinista resueltos sin tocar código).

## Peticiones a otras zonas
- PUL: pendientes de la sesión anterior (retirar z_*, ratificar readme-agentes-v2 como cubierto, reconvertir o retirar generate-visuals.mjs).
- TEST: el e2e historial-filtros no cubre la escritura en URL (sin navegador); la verificación interactiva queda documentada en el commit 28e5f98 y en el claim liberado — ampliable en su zona si lo considera.
- DIR: ratificar los 3 ticks de la sesión (toasts-coherentes, page-transitions, deep-links-historial).

## Propuestas para el roadmap (para DIR)
- (IMP-2) toasts-acción-deshacer: dar accionable el aviso de autopiloto activado (deshacer → desactivar) — src/hooks/use-arena-state.tsx
- (IMP-2) deep-links-analitica: mismo patrón replaceState para los filtros de /analitica — src/components/arena/analytics.tsx
- (PUL) sembrar en .env.example la DATABASE_URL absoluta como comentario de aviso para otros agentes (R10 les afecta igual) — .env.example
