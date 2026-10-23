# claim: e2e-historial-filtros

- ID: TEST
- Fecha: 2026-10-23 09:35 (Europe/Madrid)
- Rutas: tests/e2e/historial-filtros.e2e.mjs, docs/agentes/estado/TEST.md, docs/agentes/ROADMAP.md (solo tick de esta tarea)
- Detalle: suite e2e del historial en dos capas sin dependencia de navegador: (1) servidor real — shells de /historial y /analitica con deep-links en URL, DTO íntegro de /api/campaigns que alimenta los filtros y ficha /historial/[id] de una campaña real sembrada (BD dedicada); (2) HistoryPanel real renderizado con react-dom/server — filtros por resultado (RED/BLUE/DRAW/RUNNING), semántica DRAW, filtro por escenario, degradación del codename inexistente, intersecciones, contador «X de Y», exportación deshabilitada en vacío y contrato de búsqueda con acentos (normalizeText NFD en término y haystack). Nota: el claim se crea al cierre de la tarea por desviación del orden del §2 del protocolo en esta sesión (el trabajo se hizo antes de reclamarlo); se documenta en estado/TEST.md.
