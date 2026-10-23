# Zonas (estructura real de area-ai)
| ID | Rutas que puede modificar/borrar |
|----|----------------------------------|
| DIR | docs/agentes/ROADMAP.md, docs/agentes/OWNERSHIP.md, docs/agentes/PROTOCOLO.md |
| IMP-1 | src/lib/sim/, src/lib/lab/, src/app/api/, prisma/, y los módulos de lógica de src/lib/ (victory.ts, round-progression.ts, aggregate-report.ts, event-export.ts, knowledge-export.ts, scenario-stats.ts, db.ts), más los tests unitarios de esos módulos en tests/*.test.ts |
| IMP-2 | src/app/ (páginas, layout.tsx, globals.css, icon.svg, robots.ts, sitemap.ts; NO src/app/api/), src/components/, src/hooks/, public/, docs/screenshots/, docs/banner.svg (productor del banner; regeneración junto al README), src/lib/arena-colors.ts, download.ts, utils.ts, y los tests unitarios de esos módulos |
| PUL | README.md, .gitignore, .env.example (junto con quien añada la variable), package.json, bun.lock, eslint.config.mjs, tsconfig.json, postcss.config.mjs, components.json, next.config.ts (solo estructura, no cabeceras), scripts/ (salvo security-verify.mjs), tests/smoke.mjs, .github/, worklog.md, árbol de carpetas, limpieza (archivos muertos/duplicados) en todo el repo y refactors sin cambio de comportamiento |
| SEG | src/lib/net/ (access.ts, target-guard.ts) y sus tests, Caddyfile, cabeceras de next.config.ts, scripts/security-verify.mjs; fixes mínimos de bugs/vulnerabilidades en cualquier ruta, siempre con claim previo |
| TEST | tests/e2e/ (ficheros *.e2e.mjs), docs/agentes/hallazgos/ (crea y cierra hallazgos). NUNCA modifica código de producto |
Zona compartida (claim obligatorio, cambios aditivos): src/lib/api-types.ts (contrato API↔UI), src/lib/text.ts.
Regla: PUL no refactoriza una ruta que tenga un claim activo de otro agente. Los refactors de código propio DENTRO de una zona pertenecen a su dueño (precedente: refactor-engine-fases de IMP-1, con red de seguridad y verificación DIR); el mandato de refactor de PUL cubre la limpieza transversal del repo (archivos muertos/duplicados, estructura).
