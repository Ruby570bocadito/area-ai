# estado/SEG — Seguridad y bugs

Actualizado: 2026-10-23 10:10 (Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Tres tareas de la sección ALTA/P0 cerradas con su ciclo completo (claim → fix → puerta → release):
  · `cuerpo-chunked` — `readJsonBody` (src/lib/net/access.ts) acota el stream de peticiones chunked; 4 mutaciones migradas; 6 tests; 2 casos en security-verify.
  · `cookie-admin-httponly` — POST/DELETE `/api/auth`: login/logout con cookie `HttpOnly; SameSite=Strict; Secure`(https), 12 h, bucket `admin:`; 3 tests; 5 casos en security-verify. Sustituye a `document.cookie`.
  · `prompt-injection-evidencia` — `sanitizeForPrompt` (src/lib/text.ts) aplicado en los 4 puntos de prompt de engine.ts + acotes de `action`/`detail` almacenados (80/400). 5 tests.
- Verificadas y marcadas [x] en el ROADMAP (ya estaban hechas): token-comparacion-constante, rate-limit-memoria, csv-formula-injection, xss-evidencia-ui, errores-sin-fuga.
- `escaneo-secretos-historial`: 212 commits contra 7 familias de patrones + blobs históricos de `.env` y `db/custom.db` → LIMPIO (R7 cerrado salvo perpetuar en CI). Nota: barrido por patrones, sin binario gitleaks en este entorno.
- Puerta íntegra: 266/266 tests, lint 0, tsc 0, `verify --build` 11/11 con `rm -rf .next/cache`, security-verify 30/30 sobre standalone recién construido.

## En curso
- Nada. Colisión inicial con DIR (migración v2 duplicada) adjudicada sin pérdida: prevaleció e7f0fe4.

## Bloqueado
- Nada. `prompt-injection` se posó tras el release de IMP-1 (solape de rutas detectado y esperado 20 min).

## Peticiones a otras zonas
- PUL: README editado en 3 commits de fix (login `/api/auth`, cierre de la limitación chunked, riesgo `db:push --accept-data-loss`, nota R4 autopiloto, contadores 215→266) — revisar cotejo vigía.
- PUL: el cambio de script `db:push` sin `--accept-data-loss` (o aviso interactivo) sigue en tu zona (db-push-accept-data-loss).
- IMP-1: `autopiloto-presupuesto` pasa a ser el cierre estructural de R4 (tope diario/ventanas confirmado como hueco real, no teórico).
- IMP-2: propuesta `auth-ui` en el ROADMAP (formulario de login con `POST /api/auth`; no guardar el token en localStorage).
- TEST: `/api/auth` nuevo — añadir a `e2e-seguridad-http` (login erróneo/correcto, cookie, logout).

## Propuestas para el roadmap
- `origin-allowlist-env` (S) y `gitleaks-ci` (S) ya añadidas a la sección SEG-P2; `auth-ui` (M) a IMP-2.
- `dns-rebinding-guard`: verificado, cierre residual requiere conectar por IP con Host fijado — partir como tarea propia [L] antes de tocar target-guard.
