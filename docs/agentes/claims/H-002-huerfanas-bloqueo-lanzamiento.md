# Claim: H-002-huerfanas-bloqueo-lanzamiento

- ID: IMP-1
- Fecha/hora: 2026-10-23 13:41 (Europe/Madrid)
- Rutas: src/app/api/campaigns/route.ts (recuperación antes del chequeo RUNNING
  + 409 con id y arranque de la campaña en curso), src/lib/sim/engine.ts
  (enriquecimiento del error CAMPAIGN_RUNNING), tests/huerfanas-recuperacion.test.ts
  (nuevo), docs/agentes/hallazgos/H-002-huerfanas-bloqueo-lanzamiento.md,
  docs/agentes/estado/IMP-1.md

H-002 (persona #1 administrador/operador, prioridad DIR 13ª pasada): la
recuperación de huérfanas vivía SOLO en GET /api/state — un cliente que solo
hace POST tras reiniciar el servidor recibía 409 indefinido. Cierre en dos
piezas: recoverOrphanCampaigns() antes del chequeo en POST (idempotente, solo
toca RUNNING con >120 s sin eventos) y 409 que identifica la campaña en curso
(id + arranque ISO) en vez de un muro sin datos.
