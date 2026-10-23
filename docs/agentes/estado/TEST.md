# TEST — informe vivo

## Hecho (últimas 24 h)
- Migración v2 sembrada por orden del dueño: PROTOCOLO v2, OWNERSHIP, ROADMAP y carpetas claims/estado/hallazgos (tarea `migracion-protocolo-v2`; queda para DIR ratificarla y para PUL retirar `z_*` y congelar `worklog.md`).
- `baseline-e2e` (4+ personas: nuevo, avanzado, torpe, malintencionado, admin/operador, entorno adverso): 35 PASS / 2 FAIL sobre instancia local (puertos 3115/4415, BD propia). Los 2 FAIL son hallazgos reales (H-001, H-002); el FAIL del healthcheck era del arnés, verificado a mano en verde.
- `e2e-golden-path`: `tests/e2e/golden-path.e2e.mjs` — 14/14 PASS (BD dedicada, campaña real COMPLETED, comandos reales, escala [0,100], lecciones, engineMode).
- `e2e-doble-lanzamiento`: `tests/e2e/doble-lanzamiento.e2e.mjs` — 8/8 PASS (409/409 simultáneo, 409 secuencial, relanzamiento tras fin, 2 campañas exactas).
- `tiempo-instalacion-readme` (frío, caché bun vacía): install 10,1 s (441 paquetes) · prisma generate 0,1 s · db push ~2 s · build 24 s · campaña determinista 16-20 s · README seguido sin errores de principio a fin.
- Puerta de calidad en la copia: lint 0 errores · 215/215 tests.

## En curso
- Nada.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- SEG: H-001 (chunked activa el autopiloto saltándose el tope de cuerpo — evidencia reproducible para `cuerpo-chunked`).
- IMP-1: H-002 (huérfanas: 409 ≥120 s y recuperación solo vía `/api/state`), H-003 (5/5 campañas DRAW), H-004 (scenarioId inválido y JSON malformado lanzan campañas en silencio).
- IMP-2: H-005 (BD caída: portada 200 sin aviso; alimenta `estados-error-carga`).
- PUL: el contenedor de prueba exporta `DATABASE_URL` global que gana al `.env` en la CLI de Prisma (R10); valora un aviso en la sección Instalación del README.

## Propuestas para el roadmap
- (TEST) `e2e-seguridad-http`: formalizar como suite lo ya probado a mano (CSRF 403, 413, SSRF metadata, rate limit 6/min, coerción del autopiloto).
- (DIR) aprobar fixture de servidor OpenAI local para `e2e-model-studio-mock` (puerto del rango TEST).
