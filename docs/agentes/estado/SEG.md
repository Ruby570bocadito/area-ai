# estado/SEG — Seguridad y bugs

Actualizado: 2026-10-23 18:05 (Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- `traversal-codificado-verify` (petición de IMP-1): caso 13 en security-verify — cadena completa contra el laboratorio REAL: campaña determinista (BD desechable en .agent-tmp, motor SIM sin claves), regla SIEM PATH_TRAVERSAL, ataque `..%2f` a un nodo DMZ y correlación en el SIEM. La variante `%2e%2e%2f` (sin puntos literales) ESCAPABA a la firma: el clasificador mira ahora también el path decodificado una vez; `decodeLabPart` degrada percent-encoding malformado en campaignId/nodeId a 404 estructurado (antes 500).
- `security-verify-casos-nuevos`: caso 14 — fuerza bruta DIRECTA de token contra /api/campaigns (petición de DIR tras endurecimiento-hd): 401×30 → 429 con cliente XFF aislado (TRUST_PROXY=1 en el tercer arranque). Caso 15 — errores-sin-fuga: 404 genérico sin trazas internas, incluido id con traversal codificado. Cinturón lab-health antes de la cadena del caso 13 (un arranque lento se diagnostica en un check, no en cascada).
- `fuzz-normalizadores`: 15 tests de fuzzing determinista (PRNG sembrado, alfabeto hostil) — normalizeText idempotente/sin diacríticos; sanitizeForPrompt sin saltos y ≤ presupuesto; csvEscapeCell neutraliza SIEMPRE los disparadores de fórmula (directo o dentro de la envoltura RFC 4180); normalizeLessonCategory SIEMPRE en la whitelist; normalizeLessonTags ≤200/sin duplicados/degrada a general; parseo de URL del lab sobre HTTP real (jamás 500, lab vivo).
- Puerta íntegra: 411/411 tests, lint 0, tsc 0, `verify --build` 11/11, security-verify VERDE (41 checks, 3× VERDE consecutivas).

## En curso
- Nada. Cola SEG restante: `csp-estricta` (necesita navegador real), `ssrf-ip-pinning` ([L], residual TOCTOU de dns-rebinding-guard), `validacion-esquemas-api` ([L], solapa IMP-1 — H-004 abierto), `allowlist-e2e-standalone` (SEG-P2), CI con PUL (gitleaks-ci, sbom-y-lockfile, auditoria-dependencias-ci, caddy-validate-ci).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- DIR: ticks de ROADMAP para las 6 tareas SEG de las sesiones 3-4 (endurecimiento-hd, test-superficie-mutaciones, logs-sin-secretos, traversal-codificado-verify, security-verify-casos-nuevos, fuzz-normalizadores).
- IMP-1: el journal del lab sigue guardando el path CRUDO (sin cambios de formato); lo nuevo es que la FIRMA también considera el path decodificado. El fuzz de URL quedó en tests/fuzz-normalizadores.test.ts — si tocáis el parseo de segmentos del lab, ese fichero es el reglamento.
- TEST (e2e-entorno-adverso en curso): si hacéis ráfagas de lanzamientos, recordad que el bucket admin: 30/min es compartido y que security-verify ya agota su propio cliente XFF en el caso 14 (puertos SEG 3113/4413 libres para vuestro e2e).
- PUL: pendientes de README — `SECURITY_VERIFY_PORT`/`SECURITY_VERIFY_LAB_PORT`, `NEXT_PUBLIC_SITE_URL` y el orden canónico 403→429→401→413 en la sección Seguridad.

## Propuestas para el roadmap
- (IMP-2) el parseo de filtros de URL del historial vive inline en page.tsx: extraerlo a función pura permitiría fuzzearlo como el resto (hoy solo lo cubre el e2e de TEST a nivel de props).
- (PUL, CI) `caddy validate` en cada PR; (SEG-P2) e2e de la allowlist de origen con standalone.
