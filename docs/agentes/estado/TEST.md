# TEST — informe vivo

## Hecho (últimas 24 h)
- Sesión 1: migración v2, `baseline-e2e` (6 personas), `e2e-golden-path` (14/14), `e2e-doble-lanzamiento` (8/8), `tiempo-instalacion-readme`, hallazgos H-001..H-005.
- Sesión 2: `e2e-seguridad-http` (35/35) y **H-001 CERRADO** (resuelto verificado).
- Sesión 3: `e2e-historial-filtros` (23/23, dos capas portables).
- Sesión 4: `e2e-exportaciones` (24/24) y **H-005 CERRADO** (resuelto verificado).
- Sesión 5: `e2e-autopiloto` (35/35) — coerción, cooldown 12 s, guard RUNNING, cubo admin:.
- Sesión 6 — `e2e-entorno-adverso`: `tests/e2e/entorno-adverso.e2e.mjs`, **27/27 OK a la primera**, claim publicado antes de trabajar (e072e44). Cinco instancias standalone hostiles, cada una con puerto y BD propios:
  · S1 LAB_PORT=«abc» → el servidor arranca, el lab cae al defecto 4403 (fix Ronda 12 verificado e2e vía state.lab.port) y una campaña REAL corre igualmente.
  · S2 LAB_PORT=4425 ocupado por un oyente ajeno (node:net en la suite) → el runtime salta al 4426 (margen base..base+9) sin tocar el ajeno; campaña real corre.
  · S3 DATABASE_URL relativa (file:sin-ruta) → Prisma resuelve contra el cliente generado del standalone (.next/standalone/node_modules/.prisma/client/), CREA el fichero VACÍO (0 tablas, sin migración automática) y /api lo clasifica 503 db:down.
  · S4 BD ausente (fichero borrado) y S5 BD corrupta (bytes basura, perpetúa la verificación de H-005 como suite) → 503 db:down clasificado, portada 200, ficha 200 con id falso, listado 500 genérico SIN fuga de pilas/rutas (barrido con marcadores: « at », .ts:, node_modules, /home/z, PrismaClient).
  · Transversal: ningún escenario tumba el proceso; apagado verificado por PID en las 5 instancias.
- Sesión 7 — `e2e-volumen`: `tests/e2e/volumen.e2e.mjs`, **27/27 (3 ejecuciones consecutivas)**, claim publicado antes de trabajar (0499ff5). Masa sembrada por createMany determinista en BD dedicada (db/e2e-volumen.db, 844 ms): 1 000 campañas COMPLETED con fechas espaciadas 1 min, 12 eventos por campaña (12 000 filas) y 1 lección por campaña — SIN lanzamientos reales NI motor: IMP-1 está refactorizando engine.ts y la suite no debe depender de él. Tres capas de medición contra standalone real de main:
  · C1 historial — con 1 000 en BD, GET /api/campaigns entrega EXACTAMENTE las 500 más recientes (tope take:500 documentado): fila 1 = marcador más reciente (vol-camp-0000), orden desc estricto, DTO íntegro; la 501 (vol-camp-0500) queda FUERA del listado pero SÍ accesible por detail con sus 12 eventos (el truncado no rompe el acceso directo). Latencias 12 iteraciones: listado p95=36 ms, /api/state p95=46 ms entregando SOLO 15 recientes, detail p95=11 ms.
  · C2 render+búsqueda — HistoryPanel REAL (react-dom/server, patrón de historial-filtros) con las 500 del servidor: «500 de 500» + 500 fichas, render SSR ~300 ms; deep-links ?resultado=RED (200/500) y ?escenario= (125/500) con conteo esperado calculado desde el propio DTO (no hardcodeado); pipeline de búsqueda real normalizeText cronometrado sobre 500 DTOs — «banca» 125 hits, «energia» sin acento encuentra «Energía».
  · C3 exportación — exportadores reales: buildAggregateReport con las 500 campañas (informe .md de 125 K caracteres), buildEventsCsv/Json del detalle real (13 líneas/12 eventos), buildKnowledgeCsv/Json con los 1 000 items del servidor (1 001 líneas). Latencias < 50 ms en todos.
  · Transversal: cero 5xx en barrido de 10 rutas (incluidas /historial /analitica /conocimiento), apagado por PID.

## En curso
- Nada.

## Desviaciones de protocolo (transparencia)
- Ninguna en esta sesión.

## Bloqueado
- Navegador headless en namespace de red aislado (documentado en sesión 3): afecta a e2e-movil-visual y e2e-accesibilidad.

## Notas de verificación (para DIR/PUL)
- El producto es SÓLIDO a volumen: tope take:500 documentado en la ruta se comporta como dice su comentario, el truncado no rompe el acceso directo por id, y las latencias con 1 000 campañas detrás son excelentes (nada por encima de 50 ms). Cero hallazgos nuevos.
- Diseño de la suite (para whoever la toque): umbrales de tiempo generosos y estables para CI — la evidencia son los valores medidos en cada detail, no el umbral. Asimetría deliberada: si un día CI se ralentiza, romperá el umbral ANTES de romper la integridad, señalando degradación y no bug funcional.
- La suite es inmune al ensureSeed fundacional que dispara /api/state al primer sondeo (roster + INITIAL_KNOWLEDGE): las aserciones de knowledge cuentan desde los items DEVUELTOS por el servidor. Dato observado: el primer /api/state tras arrancar sobre BD sembrada paga el seed una vez por proceso.
- HALLAZGO DE DOCUMENTACIÓN de la sesión 6 sigue abierto para quien toque despliegue: con DATABASE_URL relativa la app NO avisa de que la BD está vacía sin tablas — da 503 db:down limpio. Una línea en el README de despliegue («usa rutas absolutas en DATABASE_URL») ahorraría el diagnóstico a alguien.
- La suite de H-005 sigue perpetua (entorno-adverso S5).

## Peticiones a otras zonas
- IMP-1: H-002 y H-004 siguen abiertos; H-003 sin cambios. Vi tu release de refactor-engine-fases en la 9ª pasada de DIR — las 8 suites e2e (ahora con volumen) son la red de seguridad: si alguna rompe, el motor cambió de comportamiento. La de volumen NO toca engine.ts a propósito (siembra directa en BD), así que te sobrevivirá.
- PUL: la nota de la sesión 5 sigue vigente (DATABASE_URL global del contenedor envenena `bun run test` sin override; con override: 411/411 — creció con los tests de SEG/IMP-1 y sigue verde).
- IMP-2: ORDEN DIRECTA del propietario (inglés en README/UI, tu claim ingles-readme-dashboard) — cuando toques copys, OJO con e2e-historial-filtros y e2e-volumen: ambas asertan textos de UI del HistoryPanel («de», «Gana RED», «Todos los escenarios») vía react-dom/server. Si los copys cambian a inglés, esas aserciones cambian con ellos. Pásame el aviso y las actualizo en la misma pasada.

## Propuestas para el roadmap
- (TEST) siguiente tarea: `e2e-actualizacion-bd` (BD de esquema anterior abierta con el esquema nuevo — conecta con la S3 de entorno-adverso) o `e2e-degradacion-llm` (proveedor caído a mitad de campaña; tocaría el motor — coordinar con IMP-1 si refactor-engine-fases sigue caliente).
- (DIR/PUL) con 8 suites e2e deterministas y sin red, `ci-basico` tiene carga real que perpetuar; la de volumen añade además cobertura de latencias con siembras de masa reproducibles en <1 s.
