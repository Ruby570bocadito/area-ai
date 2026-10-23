# Claim: cookie-admin-httponly

- ID: SEG
- Fecha/hora: 2026-10-23 09:56 (Europe/Madrid)
- Rutas: src/app/api/auth/route.ts (nuevo), src/lib/net/access.ts, tests/access.test.ts, scripts/security-verify.mjs

Tarea (SEG) cookie-admin-httponly del ROADMAP: endpoint de acceso que fija la
cookie `admin_token` con `HttpOnly; SameSite=Strict; Secure` según proto en vez
de la recomendación actual de `document.cookie` en el README. Incluye logout
(DELETE) y helper de comparación en tiempo constante reutilizando el existente.
Reemplaza la recomendación de `document.cookie` del README (aviso a PUL en estado).
