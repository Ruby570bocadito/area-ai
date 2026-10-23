# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 (Europe/Madrid) — sesión 5 cerrada

## Hecho (últimas 24 h)
- ingles-readme-dashboard (ac4b982 + b140fe3 + 5de82fa): ORDEN DIRECTA DEL PROPIETARIO («README en inglés y contenido del dashboard también en inglés») — cross-zone de README (precedente readme-visual-v2). (1) README íntegro EN con contador de tests REAL 411 en badges y scripts (corrige el 386 que DIR ya había señalado a PUL). (2) UI completa EN (~25 ficheros): shell/nav/Sistema, panel de mando, arena (fases ARMING/ESCALATION…, resultados SUCCESS/BLOCKED…), historial + CSV EN + badges RED WINS/DRAW, ficha + comparativa, conocimiento, analítica, agentes, Model Studio, atajos, paleta ⌘K, toasts, error/404; `html lang=en` + metadatos OG/Twitter EN. (3) banner.svg y og.png regeneradas EN (HTML→captura 1440×704, sin IA). (4) Galería y GIF re-hechos con 2 campañas reales sobre standalone 3112 (GIF 50 s → 8 fps/760 px, 1,2 MB). Verificación visual con navegador real en las 11 capturas. Puerta x2: lint 0 · tsc 0 · 411/411 · canon 11/11.
- Contenido obsoleto corregido al traducir: el diálogo de lanzamiento decía «8 rondas» — el motor ejecuta 12 (PHASE_ORDER = 6 fases × 2); ahora dice 12 en ambos textos.
- Decisión documentada: NO es i18n-es-en — se fija el idioma de producto a EN sin sistema de diccionarios; esa tarea [L] del ROADMAP sigue abierta (extractar textos y ofrecer ambos idiomas) y su premisa cambió: DIR decide si la re-acota o la marca obsoleta.
- text.ts (compartida) intacta: su fecha es numérica (neutra) y sus tests fijan el contrato — el mes EN del archivo se logra con locale en-GB local al componente. Cero churn de tests: 411/411 sin tocar tests/.

## En curso
- Nada (sesión cerrada).

## Bloqueado
- Nada.

## Peticiones
- A DIR/IMP-1: quedan en español los DATOS DEL MOTOR fuera de mi zona — seed (roles/especialidades de agentes, nombres/descripciones de escenarios y objetivos, codenames «OPERACIÓN …»), textos generados por el motor (action/detail de eventos, lecciones, narrativa), victory.ts (explainWinner, VICTORY_RULE_SHORT/DETAIL, decisiveProgressLabel — visibles en badges y resolution) y los mensajes de error de src/app/api/* (surfacen en toasts). Si el propietario quiere el producto 100 % EN, eso requiere tarea cross-zone de IMP-1 (seed.ts, engine, victory.ts, api) — el UI ya no muestra español propio.
- A PUL (vigía de contadores): el README ahora dice 411 (real de hoy); recordar mantener badges/contador sincronizados en futuras rondas.
- A TEST: re-verificar H-005 y los e2e existentes contra la UI EN (los selectores por texto en español de e2e si los hubiera quedarán rotos — no toqué tests/, suite 411/411 verde).

## Propuestas
- si DIR ratifica el EN como idioma de producto: renombrar rutas visibles (/historial→/history, /agentes→/agents…) en v0.4 con redirects, y traducir seed+motor (petición de arriba).
- filtros-guardados y enlace-permanente-ronda siguen como siguientes candidatas [S] de zona.
