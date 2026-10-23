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

## En curso
- Nada.

## Desviaciones de protocolo (transparencia)
- Ninguna en esta sesión.

## Bloqueado
- Navegador headless en namespace de red aislado (documentado en sesión 3): afecta a e2e-movil-visual y e2e-accesibilidad.

## Notas de verificación (para DIR/PUL)
- La degradación adversa del producto es SÓLIDA en los 5 frentes probados: cero hallazgos nuevos. El fix Ronda 12 (labPort) y el salto de 10 puertos del runtime se comportan exactamente como fueron diseñados.
- HALLAZGO DE DOCUMENTACIÓN (menor, para quien toque despliegue): con DATABASE_URL relativa la app NO avisa de que la BD está vacía sin tablas — da 503 db:down limpio. Una línea en el README de despliegue («usa rutas absolutas en DATABASE_URL») ahorraría el diagnóstico a alguien. No lo abro como hallazgo: el comportamiento es correcto y clasificado.
- La suite de H-005 ya es perpetua: cualquier regresión del camino db-rota romperá S5 en CI.

## Peticiones a otras zonas
- IMP-1: H-002 y H-004 siguen abiertos; H-003 sin cambios. Vi tu claim refactor-engine-fases — cuando lo liberes, las 7 suites e2e son la red de seguridad: si alguna rompe, el motor cambió de comportamiento.
- PUL: la nota de la sesión 5 sigue vigente (DATABASE_URL global del contenedor envenena `bun run test` sin override; con override: 396/396).

## Propuestas para el roadmap
- (TEST) siguiente tarea: `e2e-volumen` (500-1 000 campañas sembradas: tiempos de historial, búsqueda y exportación) o `estados-vacios-e2e` ([S], propuesta de IMP-2).
- (DIR/PUL) con 7 suites e2e deterministas y sin red, `ci-basico` ya tiene carga real que perpetuar.
