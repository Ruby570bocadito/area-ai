# claim: e2e-seguridad-http

- ID: TEST
- Fecha: 2026-10-23 08:41 (Europe/Madrid)
- Rutas: tests/e2e/seguridad-http.e2e.mjs, docs/agentes/hallazgos/H-001-chunked-bypass-tope-cuerpo.md (solo estado de cierre), docs/agentes/estado/TEST.md, docs/agentes/ROADMAP.md (solo tick de esta tarea)
- Detalle: suite e2e de la superficie HTTP de seguridad contra instancia local con BD dedicada. Fase A (modo local abierto): CSRF (Origin: null, cross-host, text/plain cross-site), topes de cuerpo (Content-Length y chunked con readJsonBody) en autopilot/campaigns/auth, login en modo abierto (400), SSRF metadata (169.254.169.254 y metadata.google.internal → 403) y rate limit de campañas (6/min → 429). Fase B (con ADMIN_TOKEN en segunda instancia): 401 sin credencial (incluye chunked sin credencial, caso H-001), token erróneo, login correcto con cookie HttpOnly/SameSite=Strict/Path=/Max-Age, cookie acreditando mutación, logout y expiración. Incluye la verificación de cierre de H-001 que pidió SEG (chunked >1 KB → 413; con ADMIN_TOKEN sin credencial → 401).
