# estado/SEG — Seguridad y bugs

Actualizado: 2026-10-23 15:20 (Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- `endurecimiento-hd` (HD3/HD4, rescatada por DIR): orden canónico de barreras 403→429→401→413 aplicado y documentado en access.ts. En /api/campaigns el token se comparaba SIN haber consumido antes el bucket `admin:` — 401 infinitos sin tope (oráculo de fuerza bruta de ADMIN_TOKEN): añadido el cubo admin: antes del token (el cubo campaigns: 6/min queda tras el 401 para el gasto R4). settings y models parseaban el cuerpo antes del 429/401: parseo tras el 401. autopilot ya era canónico; auth conserva 413 antes del 401 por inherencia (token en el cuerpo).
- `test-superficie-mutaciones`: test estructural que DESCUBRE por directorio los handlers POST/PUT/PATCH de src/app/api/ y exige contra el handler real los tres controles (403 primero · ráfaga 401→429 al 31º · 429 con token válido); DELETE solo en la exención documentada (logout). Una mutación futura sin controles rompe la suite sin tocar el test. 18 tests.
- `logs-sin-secretos`: barrido de los 19 console.* de src/ y de aggregate/event/knowledge-export — LIMPIO (solo objetos de error y mensajes de negocio; la API key viaja siempre enmascarada por maskKey). Tripwire perpetuado en tests/logs-sin-secretos.test.ts.
- `fix(security-verify)`: agente HTTP de un solo uso en las peticiones chunked — el cuerpo chunked puede quedar sin leer en el servidor (401 antes de readJsonBody) y la reutilización del socket desincronizaba la petición siguiente (400 vacío intermitente en el login, ~20% de las pasadas de hoy); 8/8 VERDE tras el fix. Diagnóstico del login mejorado (cuerpo en el extra).
- Puerta íntegra: 386/386 tests, lint 0, tsc 0, `verify --build` 11/11, security-verify VERDE.

## En curso
- Nada. Cola SEG restante: `fuzz-normalizadores`, `security-verify-casos-nuevos`, `csp-estricta` (necesita navegador real), `dns-rebinding-guard` (partir como [L]), `validacion-esquemas-api` ([L], solapa IMP-1 — H-004 abierto), CI con PUL (gitleaks-ci, sbom-y-lockfile, auditoria-dependencias-ci).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- PUL: pendientes de README — `SECURITY_VERIFY_PORT` en la tabla de scripts, descripción de `NEXT_PUBLIC_SITE_URL` (allowlist de origen) y el orden canónico de barreras en la sección Seguridad (403→429→401→413).
- DIR: pedir ticks de ROADMAP para security-verify-puerto, cabeceras-extra, caddy-hardening, origin-allowlist-env (cerradas en la sesión anterior) y endurecimiento-hd, test-superficie-mutaciones, logs-sin-secretos (esta); y actualizar la nota de §6 del PROTOCOLO (puerto ya parametrizado).
- IMP-1: el test de superficie incluye campaigns — el cubo admin: compartido consume ahora también los lanzamientos (30/min); el e2e de TEST que haga ráfagas de lanzamientos debe contar con ello.
- TEST: H-001 verificado y cerrado — gracias; los casos 9/11 de security-verify y la suite e2e lo perpetúan.

## Propuestas para el roadmap
- (PUL, CI) validar `Caddyfile` con `caddy validate` en cada PR (el sandbox local no ejecuta el binario).
- (SEG-P2) e2e de la allowlist de origen con `NEXT_PUBLIC_SITE_URL` arrancando el standalone.
