# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 13:20 (Europe/Madrid)

## Hecho (últimas 24 h)
- H-005 (hallazgo, UX): reproducido el escenario de TEST en standalone con BD corrupta (API 503, portada 200) y verificado el núcleo ya cubierto: tarjeta role=alert «Sin conexión con el motor» con reintento tras 2 sondeos fallidos, también en ficha con id falso. Marcado resuelto-pendiente-verificación.
- H-005 complemento (commit 953cf88): el widget del sidebar mostraba «En espera» verde y «0 campañas / 0 lecciones» inventadas con el motor caído; ahora el chip de conexión (topbar + sidebar) pasa a rojo «Sin conexión» con prioridad sobre En directo/En espera, y proveedor/campañas/lecciones muestran «—» mientras no hay estado cargado. Ruta sana verificada sin regresión (cifras reales). Puerta: lint 0 · 335/335 · canon 11/11 (SMOKE_PORT 3112, LAB_PORT 4412).
- Nota de sandbox: en dev con HMR bloqueado por origen el sondeo no arranca (peculiaridad del entorno, no del producto); la verificación de H-005 se hizo en standalone producción como documentó TEST.

## En curso
- (nada — sesión cerrada tras 3 piezas: H-005, barra-estado-sistema y atajos-teclado)

## Cerrado en esta sesión (resumen)
- barra-estado-sistema (P1, commit f1a5939): panel «Sistema» en el sidebar (y drawer móvil) — BD Operativa/Caída (healthcheck GET /api consultado SOLO tras fallo del sondeo: coste cero en operación sana), Lab HTTP en línea :puerto/fuera de línea, Motor LLM (proveedor + aviso ámbar «Determinista» cuando la campaña en pantalla arrancó en SIM vía engineMode). Toque compartido aditivo: engineMode?: string en CampaignSummaryDTO. Puerta: lint 0 · 354/354 · canon 11/11.
- atajos-teclado (P1, commit 4247043): overlay de ayuda con ? (tecla global + botón topbar), 7 secuencias g+tecla de salto de sección con ventana de 900 ms, guarda de campos de texto; verificado en standalone (g→h navega; no navega desde un input). Puerta: lint 0 · 384/384 · canon 11/11.

## Bloqueado
- (nada)

## Peticiones a otras zonas
- PUL: retirar docs/agentes/z_* y congelar worklog.md (migración v2, pasos 3-4); tabla "Agentes del proyecto" del README con los 6 roles.
- TEST: verificar H-005 con los pasos del propio hallazgo (≈12 s de espera para la tarjeta).

## Propuestas para el roadmap (para DIR)
- (IMP-2) page-transitions — transición compartida entre rutas con template.tsx; MotionConfig ya envuelve todo — src/app/
- (IMP-2) estados-vacios-e2e — TEST: cubrir banner de desconexión, tarjeta de reintento y EmptyState (persona "usuario torpe") — tests/e2e/
- (DIR) idea: deep-links de filtros del historial en la URL (patrón D6 de analítica) antes de "filtros-guardados" — src/components/arena/history-panel.tsx
