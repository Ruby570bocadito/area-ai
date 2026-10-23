# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 15:10 (Europe/Madrid)

## Hecho (últimas 24 h)
- ui-pro-reactbits (orden directa del propietario, 46b384c + 0b67312): retiradas las 6 imágenes generadas por IA de los escenarios y la og.png de IA; React Bits OFICIALES (github.com/DavidHDev/react-bits, src/ts-default) integrados SIN dependencias nuevas en src/components/arena/reactbits/ (Particles WebGL, ShinyText, GradientText, GlareHover — adaptación local mínima: refs sincronizadas en efecto por react-hooks/refs); héroe oscuro de la portada con campo RED/BLUE (omitido con prefers-reduced-motion); ScenarioArt SVG procedural y determinista por escenario (malla + nudo + haces RED/BLUE) con destello GlareHover en las tarjetas; og.png nueva diseñada por código (HTML→captura 1200×630). Puerta: tsc 0 · lint 0 · 386/386 · canon 11/11.
- readme-visual-v2 (CROSS-ZONE por orden del propietario, 7d7df0e + 6b0bdc0): README nuevo — banner docs/banner.svg (SVG de marca dibujado a mano, sin IA), badges, gráfico mermaid del flujo de campaña, galería con 8 capturas reales nuevas (1440×900) + GIF de campaña real (campana-en-vivo.gif: 2,2 MB · 8 fps · 760 px,FinCorp Bank completa) + atajos-teclado.png y vista-movil.png; tabla de agentes sustituida por los 6 roles v2; contadores 266→386. docs/screenshots/ regenerada entera desde la app real (viejas borradas, historial en git).
- H-005 (hallazgo, UX): reproducido el escenario de TEST en standalone con BD corrupta (API 503, portada 200) y verificado el núcleo ya cubierto: tarjeta role=alert «Sin conexión con el motor» con reintento tras 2 sondeos fallidos, también en ficha con id falso. Marcado resuelto-pendiente-verificación.
- H-005 complemento (commit 953cf88): el widget del sidebar mostraba «En espera» verde y «0 campañas / 0 lecciones» inventadas con el motor caído; ahora el chip de conexión (topbar + sidebar) pasa a rojo «Sin conexión» con prioridad sobre En directo/En espera, y proveedor/campañas/lecciones muestran «—» mientras no hay estado cargado. Ruta sana verificada sin regresión (cifras reales). Puerta: lint 0 · 335/335 · canon 11/11 (SMOKE_PORT 3112, LAB_PORT 4412).
- Nota de sandbox: en dev con HMR bloqueado por origen el sondeo no arranca (peculiaridad del entorno, no del producto); la verificación de H-005 se hizo en standalone producción como documentó TEST.

## En curso
- (nada — sesión cerrada: H-005, barra-estado-sistema, atajos-teclado, ui-pro-reactbits y readme-visual-v2)

## Cerrado en esta sesión (resumen)
- barra-estado-sistema (P1, commit f1a5939): panel «Sistema» en el sidebar (y drawer móvil) — BD Operativa/Caída (healthcheck GET /api consultado SOLO tras fallo del sondeo: coste cero en operación sana), Lab HTTP en línea :puerto/fuera de línea, Motor LLM (proveedor + aviso ámbar «Determinista» cuando la campaña en pantalla arrancó en SIM vía engineMode). Toque compartido aditivo: engineMode?: string en CampaignSummaryDTO. Puerta: lint 0 · 354/354 · canon 11/11.
- atajos-teclado (P1, commit 4247043): overlay de ayuda con ? (tecla global + botón topbar), 7 secuencias g+tecla de salto de sección con ventana de 900 ms, guarda de campos de texto; verificado en standalone (g→h navega; no navega desde un input). Puerta: lint 0 · 384/384 · canon 11/11.

## Bloqueado
- (nada)

## Peticiones a otras zonas
- PUL: retirar docs/agentes/z_* y congelar worklog.md (migración v2, pasos 3-4).
- PUL: readme-agentes-v2 quedó CUBIERTO por IMP-2 dentro de readme-visual-v2 (orden del propietario) — ratificar y tickar; el contador de tests del README (386) lo sigue el vigía de PUL.
- PUL: scripts/generate-visuals.mjs generaba justamente las imágenes IA retiradas — reconvertir a generador de capturas/GIF reales (el flujo de IMP-2 usa agent-browser + ffmpeg) o retirarlo; OUT_DIR apunta a /home/z/my-project/public (ruta muerta).
- DIR: ratificar los ticks/documentación de esta sesión en el ROADMAP (ui-pro-reactbits y readme-visual-v2 son órdenes directas del propietario, documentadas en claims liberados).
- TEST: verificar H-005 con los pasos del propio hallazgo (≈12 s de espera para la tarjeta).

## Propuestas para el roadmap (para DIR)
- (IMP-2) page-transitions — transición compartida entre rutas con template.tsx; MotionConfig ya envuelve todo — src/app/
- (IMP-2) estados-vacios-e2e — TEST: cubrir banner de desconexión, tarjeta de reintento y EmptyState (persona "usuario torpe") — tests/e2e/
- (DIR) idea: deep-links de filtros del historial en la URL (patrón D6 de analítica) antes de "filtros-guardados" — src/components/arena/history-panel.tsx
