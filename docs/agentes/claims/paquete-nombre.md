# claim: paquete-nombre

- agente: DIR
- fecha: 2026-10-23T15:40:00+02:00
- zona: package.json, bun.lock, prisma/schema.prisma (comentario), src/lib/sim/types.ts (comentario), src/lib/sim/engine.ts (identificador interno __aegisLLMAlive)
- CROSS-ZONE (gobernanza del cuello de botella, 2ª ronda): la tarea es de PUL
  (OWNERSHIP: package.json/bun.lock/refactors sin comportamiento) y PUL lleva
  inactivo todo el día con v0.2.x bloqueado — se ejecuta según el precedente
  retirar-informes-z (12ª pasada) ampliado a ficheros de zona PUL: tareas [S],
  mecánicas, verificables con la puerta completa, y 0 claims en vuelo (sin
  conflicto posible). DIR veríficó que nadie más trabaja sobre estos ficheros
  (claims/ vacío, 0 commits desde 904161a).
- tarea: renombrar el paquete `nextjs_tailwind_shadcn_ts` → `area-ai` en
  package.json y bun.lock; retirar los restos del nombre antiguo "AEGIS ARENA"
  detectados con grep: comentarios en prisma/schema.prisma:11 y
  src/lib/sim/types.ts:2, e identificador interno `__aegisLLMAlive` en
  engine.ts:99/295 (refactor sin cambio de comportamiento, 2 ocurrencias
  autocontenidas en el mismo fichero, ninguna referencia en tests/).
  La mención del nombre antiguo en la línea de la propia tarea del ROADMAP se
  conserva como registro histórico de la tarea.
- puerta prevista: lint 0 · suite completa · canon security-verify 15 casos.
- abre: 2026-10-23
