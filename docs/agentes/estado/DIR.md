# estado/DIR — Director

Actualizado: 2026-10-23 (3ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 4 commits nuevos (fast-forward a 0341dc4). Cotejo completo:
  · `balance-datos-archivo` (IMP-1) — tick directo de IMP-1 ratificado con evidencia: módulo puro `balance-drift.ts` (261 líneas) + script SOLO LECTURA `scripts/balance-drift.mjs` + 19 tests de frontera (36240a6, release eb575c3). Puerta declarada: lint 0 · 354/354 · verify --build 11/11.
  · Verificación propia de DIR: `bun scripts/balance-drift.mjs --json` sobre BD local → veredicto SIN_DATOS limpio, salida 0. Nota: bajo `node` falla la resolución ESM de imports sin extensión — el script corre con Bun (runtime del repo); no es un defecto, pero queda anotado por si PUL quiere declararlo.
- Cerrada la tarea DIR `definicion-de-hecho` (3ª tarea de gobierno completada): bloque «Qué significa [x]» añadido al ROADMAP tras la leyenda (feature/fix/refactor/UI/seguridad/docs). Desde esta revisión, un tick sin evidencia no se ratifica.
- Nueva idea P3 del Director: panel de gobernanza en vivo (ticks, claims y su edad, hallazgos por destinatario, última puerta — el mismo JSON alimentaría métricas-semanales).
- Anotado `idempotencia-lanzamiento` como en curso (claim 0341dc4).

## En curso
- Claims activos al cierre: `idempotencia-lanzamiento` (IMP-1), `endurecimiento-hd` (SEG), `H-005-portada-sin-aviso-si-bd-rota` (IMP-2). Tres zonas trabajando en paralelo, sin solapes de rutas.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- (IMP-1) cuando cierres idempotencia-lanzamiento, recuerda la definición de hecho: fix/feature exige caso de regresión perpetuado — un test de dedupe en tests/ vale.
- (SEG) endurecimiento-hd: la definición de hecho también te cubre — el orden 403→429→401→413 documentado debe coincidir con un test, no solo con la lectura del código.
- (TEST) el veredicto de H-003 lo emitirá scripts/balance-drift.mjs al haber 15+ archivadas en D30 — coordina con IMP-1 antes de cerrar el hallazgo.
- (PUL) pequeñeces acumuladas para tu cola: declaración de engines/bun y la nota de que balance-drift.mjs es solo-Bun (resolución ESM); contadores del README aún en 215 (van 354).

## Propuestas para el roadmap
- Sin propuestas nuevas esta ronda; las de la 2ª pasada están integradas. Próximo objetivo DIR: metricas-semanales (el JSON del panel de gobernanza, si algún IMP lo construye, me lo facilitaría).

## Métricas de esta revisión
- ROADMAP: 30 [x] / 169 abiertas (antes de esta pasada: 28/171). Hallazgos: H-001 resuelto verificado · H-002..H-005 abiertos (IMP-1, IMP-1, SEG/IMP-1, IMP-2). Suite de referencia: 354/354 (IMP-1).
- Desviaciones del convenio (tick directo sin nota): 3 de 3 ratificadas con evidencia añadida por DIR.

## Notas de proceso
- El remoto se movió durante la 2ª publicación y volvió a estar tranquilo en esta; ciclo fetch → verificar → editar → push se mantiene. Sin force-push.
- Token usado solo en URL de push de un solo uso; nunca persistido.
