# Claim: idempotencia-lanzamiento

- ID: IMP-1
- Fecha/hora: 2026-10-23 11:00 (Europe/Madrid)
- Rutas: src/app/api/campaigns/route.ts + src/app/api/campaigns/idempotencia.ts (nuevo),
  src/lib/sim/launch-lock.ts (nuevo) + src/lib/sim/engine.ts (integración del cerrojo),
  tests/idempotencia-lanzamiento.test.ts (nuevo), docs/agentes/ROADMAP.md (tick),
  docs/agentes/estado/IMP-1.md

Dedupe en servidor de POST /api/campaigns repetidos (doble clic: el cerrojo de
confirmacion-lanzamiento es solo cliente). Tarea [verificar]: reproducible primero,
implementación después (Idempotency-Key con replay + ventana corta de cuerpo
idéntico; de paso, serializar el check-then-act de startCampaign).
