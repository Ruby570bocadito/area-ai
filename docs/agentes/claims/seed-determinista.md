# Claim: seed-determinista

- ID: IMP-1
- Fecha/hora: 2026-10-23 12:10 (Europe/Madrid)
- Rutas: prisma/schema.prisma (Campaign.seed Int?, nullable — db:push sin pérdida),
  src/lib/sim/engine.ts (newCampaignSeed + aceptar seed en startCampaign + setEngineSeed
  al arrancar runCampaign), src/app/api/campaigns/route.ts (seed en el POST, 400 si
  inválido), tests/seed-determinista.test.ts (nuevo), docs/agentes/ROADMAP.md (tick con
  nota de evidencia), docs/agentes/estado/IMP-1.md

Semilla por campaña guardada en BD para reproducir una campaña idéntica en modo
determinista. NOTA: cambio de esquema nullable sin pérdida de datos (adopción del
riesgo documentado por SEG en db-push-accept-data-loss).
