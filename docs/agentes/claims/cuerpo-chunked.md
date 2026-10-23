# Claim: cuerpo-chunked

- ID: SEG
- Fecha/hora: 2026-10-23 09:48 (Europe/Madrid)
- Rutas: src/lib/net/access.ts, tests/access.test.ts, src/app/api/campaigns/route.ts, src/app/api/autopilot/route.ts, src/app/api/settings/route.ts, src/app/api/models/route.ts, scripts/security-verify.mjs

Tope de cuerpo para peticiones chunked sin Content-Length (tarea (SEG) cuerpo-chunked
del ROADMAP): lectura del stream con tope en `readJsonBody` (src/lib/net/access.ts),
aplicada en las 4 mutaciones, test de regresión y caso nuevo en security-verify.
Cambio mínimo; `contentLengthExceeds` se conserva como vía rápida.
