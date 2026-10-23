# estado/SEG — Seguridad y bugs

Actualizado: 2026-10-23 19:40 (Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- `ssrf-ip-pinning` [L] (sesión 5): cierre del TOCTOU residual del guard (R13) — nuevo `src/lib/net/safe-fetch.ts`: resuelve UNA vez, clasifica ese mismo lote con el MISMO criterio del guard (piezas compartidas extraídas a target-guard.ts: classifyAddresses/classifyHostname/normalizeHostname — classifyTarget con comportamiento idéntico) y CONECTA a esa IP exacta: http vía fetch nativo a la URL-IP con cabecera Host original; https vía cliente HTTP/1.1 mínimo sobre node:tls con servername = hostname (TCP a la IP, SNI y verificación del cert al NOMBRE; chunked y content-length con buffer persistente, tope 4 MB, plazo total). Sin resolución no hay conexión (fail-closed); metadata SIEMPRE bloqueada (hostname/DNS/literal, precede a la política); 3xx sin seguir en ambos esquemas; credenciales en URL rechazadas. bun ignora createConnection (sondeado) — por eso las dos vías. Los DOS fetch salientes a URL de usuario (GET {baseUrl}/models en /api/models y POST {baseUrl}/chat/completions en llm.ts) pasan por safeFetch: las pre-barreras de política de las rutas se mantienen (400/403 con mensajes precisos) y el pin es el punto de cumplimiento; en llm.ts se retiró la pre-clasificación (una resolución DNS menos y bloqueo de metadata en el punto de uso, mejor momento).
- Regresión hermética: 25 tests en tests/safe-fetch.test.ts (DNS falso con contador — lookup UNA vez y una segunda resolución JAMÁS sucede; servidores http y TLS locales con cert autofirmado de tests/fixtures; Host original preservado; conexión a la IP fijada; metadata por las tres vías; política; literales sin DNS; dns-failed; tope de respuesta; plazo; 3xx; chunked). E2E manual: /api/models 200 contra proveedor local real vía pin, metadata 403, settings sin cambios.
- Puerta íntegra: 436/436 tests, lint 0, tsc 0, build ✓, `verify --build` 11/11, security-verify VERDE (los 20 checks de la canon + casos 13-15).

## En curso
- Nada. Cola SEG restante: `allowlist-e2e-standalone` (SEG-P2), `validacion-esquemas-api` ([L], solapa IMP-1 — H-004 abierto), `csp-estricta` (necesita navegador real), CI con PUL (gitleaks-ci, sbom-y-lockfile, auditoria-dependencias-ci, caddy-validate-ci).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- DIR: ticks de ROADMAP para las 7 tareas SEG de las sesiones 3-5 (endurecimiento-hd, test-superficie-mutaciones, logs-sin-secretos, traversal-codificado-verify, security-verify-casos-nuevos, fuzz-normalizadores, ssrf-ip-pinning) y actualización del riesgo R13 (TOCTOU cerrado en los dos puntos de uso; el residual son sockets que no pasen por safeFetch).
- IMP-1: los módulos de red nuevos son `src/lib/net/safe-fetch.ts` (fetch saliente con pin) y las piezas compartidas del guard — para CUALQUIER fetch futuro a URL de usuario el protocolo §6 se cumple con safeFetch, no con fetch directo. Los tests herméticos de red viven en tests/safe-fetch.test.ts.
- TEST: el caso de fuerza bruta del caso 14 sigue agotando su propio cliente XFF; los 25 tests nuevos no tocan red real (DNS falso), sin riesgo para vuestros e2e.
- PUL: pendientes de README — `SECURITY_VERIFY_PORT`/`SECURITY_VERIFY_LAB_PORT`, `NEXT_PUBLIC_SITE_URL` y el orden canónico 403→429→401→413 en la sección Seguridad.

## Propuestas para el roadmap
- (IMP-2) el parseo de filtros de URL del historial vive inline en page.tsx: extraerlo a función pura permitiría fuzzearlo como el resto (hoy solo lo cubre el e2e de TEST a nivel de props).
- (PUL, CI) `caddy validate` en cada PR; (SEG-P2) e2e de la allowlist de origen con standalone.
