# claim: e2e-autopiloto

- ID: TEST
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: tests/e2e/autopiloto.e2e.mjs, docs/agentes/estado/TEST.md, docs/agentes/ROADMAP.md (solo tick de esta tarea)
- Detalle: suite e2e del modo de operación continua en dos capas (BD dedicada db/e2e-autopiloto.db, puertos TEST). Capa HTTP real contra standalone: GET/POST /api/autopilot — activar y desactivar con booleano real, coerción estricta del cuerpo (`"true"`/`"false"` en cadena, 1, null, body vacío → desactiva; solo `true` literal activa; el bug histórico era Boolean("false")===true), orden de barreras (CSRF 403 → 429 rate limit admin: → 401 sin ADMIN_TOKEN si se configura → 413 cuerpo >1 KB → 400 JSON inválido), eco del estado en /api/state (`autopilot`). Capa semántica de maybeRunAutopilot vía sondeos reales a /api/state: OFF → nunca arranca campañas; ON → arranca exactamente una cuando el motor está ocioso y pasado el cooldown de 12 s (fila sembrada con endedAt reciente en la BD dedicada para acotar el tiempo); RUNNING activo → no arranca segunda; con ON activo una campaña determinista real arrancada por el autopiloto debe completar y dejar el modo listo para repetir.
