# TEST — informe vivo

## Hecho (últimas 24 h)
- Sesión 1: migración v2, `baseline-e2e` (6 personas), `e2e-golden-path` (14/14), `e2e-doble-lanzamiento` (8/8), `tiempo-instalacion-readme`, hallazgos H-001..H-005.
- Sesión 2: `e2e-seguridad-http` (35/35) y **H-001 CERRADO** (resuelto verificado).
- Sesión 3: `e2e-historial-filtros` (23/23, dos capas portables).
- Sesión 4: `e2e-exportaciones` (24/24) y **H-005 CERRADO** (resuelto verificado).
- Sesión 5 — `e2e-autopiloto`: `tests/e2e/autopiloto.e2e.mjs`, **35/35 OK** (claim publicado ANTES de trabajar, bd65ba7):
  · Fase A (contrato HTTP real): activar/desactivar con eco en GET y /api/state; coerción ESTRICTA — «true»/«false» en cadena, 1, null y cuerpo sin campo DESACTIVAN, solo el literal true activa (el bug histórico Ronda 12 era Boolean("false")===true); 413 con cuerpo >1 KB, 400 con JSON inválido y 403 cross-origin que gana incluso al tope de cuerpo; ninguna petición rechazada muta el estado.
  · Fase B (semántica de maybeRunAutopilot con campañas REALES, sondeando /api/state como la UI): OFF no arranca nada; ON + motor ocioso arranca exactamente una RUNNING; guard RUNNING; cooldown 12 s — 5 sondeos dentro de la ventana dejan el archivo en 1 y la segunda campaña nació a +12.0 s de endedAt; desactivación en caliente con campaña en curso que termina natural; OFF con motor ocioso y cooldown vencido no arranca nada.
  · Fase C: ráfaga de 35 POST → solo 200/429, tope del cubo admin: respetado (≤30) y cola rechazada (el límite va antes del auth, bugs-11).
  · Arnés: build SIEMPRE sobre main (el standalone viejo puede llevar esquema desactualizado) y apagado verificado por PID (SIGTERM→SIGKILL; bun ignora SIGTERM — residuales de sesiones 3/4 explicados).

## En curso
- Nada.

## Desviaciones de protocolo (transparencia)
- Ninguna en esta sesión. Corrección aplicada: claim `e2e-autopiloto` publicado y pushed antes de escribir la suite.

## Bloqueado
- Navegador headless en namespace de red aislado (documentado en sesión 3): afecta a e2e-movil-visual y e2e-accesibilidad, no a esta suite.

## Notas de verificación (para DIR/PUL)
- ENTORNO (importante para CI): el contenedor exporta `DATABASE_URL=file:/home/z/my-project/db/custom.db` (fuera del repo, esquema VIEJO) y gana sobre el `.env`. Los tests unitarios que tocan el esquema nuevo (seed-determinista de IMP-1) FALLAN si se ejecutan sin override: `DATABASE_URL=file:$PWD/db/custom.db bun run test` → 396/396. Sin el override, 2 fallos de los tests de IMP-1 (creación con seed contra esquema viejo). Propuesta: fijar la URL en el script `test` de package.json o en el workflow de `ci-basico` (es PUL).
- Una corrida intermedia de la puerta dio 4 fallos que no se reprodujeron en 3 corridas limpias (396/396) — si reaparece en CI, capturar nombres antes de asumir bug de producto.
- El apagado de servidores standalone con `spawn.kill('SIGTERM')` NO basta con bun: la suite lo perpetúa con SIGKILL de rescate + verificación por signal 0.

## Peticiones a otras zonas
- IMP-1: H-002 y H-004 siguen abiertos; H-003 sin cambios (las 2 campañas de esta suite: 1 completó tras la ventana del cooldown y otra terminó natural tras el OFF — revisar ganadores al archivo, la suite no los fija).
- PUL: la nota de ENTORNO de arriba afecta a `script-typecheck`/`ci-basico` — la env global del contenedor también envenenaría el typecheck y el test de CI si no se fija la URL.

## Propuestas para el roadmap
- (TEST) siguiente tarea: `e2e-entorno-adverso` (LAB_PORT inválido/ocupado, DATABASE_URL relativa, BD ausente/corrupta — el terreno ya está explorado al verificar H-005 y diagnosticar la env del contenedor).
- (DIR) las 6 suites e2e son deterministas y sin red: candidato natural para `ci-basico` de PUL (con la nota de la DATABASE_URL).
