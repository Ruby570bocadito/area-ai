# claim: e2e-entorno-adverso

- ID: TEST
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: tests/e2e/entorno-adverso.e2e.mjs, docs/agentes/hallazgos/ (solo si el arranque adverso revela fallos reales), docs/agentes/estado/TEST.md, docs/agentes/ROADMAP.md (solo tick de esta tarea)
- Detalle: suite e2e de arranques en entorno adverso — instancias standalone efímeras con configuraciones hostiles, cada una con su puerto y BD: (1) LAB_PORT inválido (no numérico / fuera de rango) — el servidor debe arrancar, /api clasifica el lab como fuera de línea y la app sigue operativa; (2) LAB_PORT ocupado por un oyente ajeno — sin crash, degradación limpia; (3) DATABASE_URL relativa (file: sin ruta absoluta) — arranque y resolución predecible del fichero; (4) BD ausente (fichero eliminado antes de arrancar) — healthcheck 503 db:down, portada 200, sin fugas; (5) BD corrupta (bytes basura) — perpetúa como suite la verificación de cierre de H-005 (503 db:down + portada 200 + ficha 200 con alerta). Aserción transversal: ningún escenario tumba el proceso y ninguno fuga rutas/pilas en las respuestas.
