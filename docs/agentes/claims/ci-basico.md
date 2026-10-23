# claim: ci-basico

- agente: TEST
- fecha: 2026-10-23T16:05:00+02:00
- zona: .github/workflows/ci-basico.yml (fichero NUEVO, directorio .github/ nace con este claim)
- CROSS-ZONE (autorización DIR, 12ª pasada, anotada en la propia tarea del
  ROADMAP): «reclamable por TEST si PUL sigue inactivo (su browser-e2e-ci
  depende de esta y ya documentó las notas de DATABASE_URL y standalone build;
  misma regla de gobierno: claim previo, ROADMAP intacto, DIR ratifica)».
  PUL sigue inactivo (0 sesiones en el día; DIR acaba de ejecutar 2 tareas de
  PUL por el mismo gobierno del cuello de botella — claims paquete-nombre y
  congelar-worklog). Mis propuestas publicadas en estado/TEST.md (sesiones 10
  y 9) ya apuntaban aquí. ROADMAP INTACTO: NO toco el tick — ratifica DIR.
- tarea: workflow de CI básico en GitHub Actions — `bun install`, lint,
  `bun run test` y typecheck en push/PR, con caché de bun.
- decisiones de diseño (todas salen de notas ya verificadas en este repo):
  (1) DATABASE_URL fija en el workflow (nota sesión 5: la global del contenedor
  envenena `bun run test` sin override — en CI se elimina la ambigüedad fijando
  `file:${{ github.workspace }}/db/ci.db` a nivel de job, y `mkdir -p db` +
  `prisma db push` antes de los tests porque en un checkout limpio `db/` no
  existe — todo *.db está gitignoreado);
  (2) BUILD FRESCO OBLIGATORIO antes de e2e (lección sesión 9: las suites
  reutilizan .next/standalone si existe — `rm -rf .next && bun run build`
  explícito antes del bucle);
  (3) las 11 suites e2e en BUCLE SECUENCIAL (`for suite in tests/e2e/*.e2e.mjs;
  do bun "$suite"; done`) — todas son deterministas y sin red, cada una
  auto-bootstrapea su BD dedicada (`prisma db push --skip-generate` propio),
  y la serialización da corrida estable (nota del flake observado en sesión 10
  bajo paralelismo de bun test);
  (4) typecheck AUTOSUFICIENTE con `bunx tsc --noEmit` (typescript ^5 está en
  devDependencies) — NO toco package.json: el script `typecheck` es la tarea
  script-typecheck, zona de otro agente; cuando aterrice, el workflow puede
  migrar a `bun run typecheck` en una línea;
  (5) caché de bun vía actions/cache sobre ~/.bun/install/cache con clave
  hashFiles('bun.lock');
  (6) disparadores: push a main, pull_request a main y workflow_dispatch;
  concurrency con cancel-in-progress para no acumular corridas.
- SIN COLISIÓN con claims en vuelo: DIR (package.json/bun.lock/schema.prisma/
  engine.ts/comments + worklog/PROTOCOLO), IMP-1 (H-006 motor), IMP-2
  (enlace-permanente-ronda) — mi único fichero es nuevo y aislado.
- verificación prevista (honesta, en este contenedor): YAML parseado por
  parser externo + SIMULACIÓN LOCAL DE CADA PASO del workflow en su orden
  exacto (mkdir db · db push sobre BD fresca · lint · tsc --noEmit ·
  `bun run test` con DATABASE_URL fija · build fresco · bucle secuencial de
  las 11 suites) — lo que GitHub ejecutará es exactamente lo que ejecuto aquí.
- abre: 2026-10-23
