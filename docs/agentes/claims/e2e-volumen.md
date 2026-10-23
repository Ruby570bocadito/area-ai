# claim: e2e-volumen

- ID: TEST
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: tests/e2e/volumen.e2e.mjs (nuevo), db/e2e-volumen.db (BD dedicada, ignorada)
- Detalle: suite e2e de volumen — 1 000 campañas COMPLETED sembradas directamente en BD dedicada (createMany, sin LLM ni lanzamientos reales), tres capas de medición sobre servidor standalone de main: (1) historial — GET /api/campaigns a volumen: tope take:500 documentado (debe entregar EXACTAMENTE las 500 más recientes de 1 000, orden startedAt desc), latencia p50/p95/max sobre iteraciones repetidas; (2) búsqueda + render — HistoryPanel real vía react-dom/server (patrón de historial-filtros) con las 500 campañas del servidor, render y filtro de búsqueda normalizado cronometrados; (3) exportación — buildEventsCsv/buildEventsJson/buildKnowledgeCsv sobre datos reales del servidor a volumen (detalle + knowledge), integridad de filas y latencia. Transversal: /api/state (solo 15 recientes) no debe degradarse, ningún 5xx, apagado verificado por PID. Umbrales de tiempo generosos y estables para CI (la suite registra los valores medidos como evidencia, no como roca).
- Sin tocar: src/, prisma/schema, otras suites.
