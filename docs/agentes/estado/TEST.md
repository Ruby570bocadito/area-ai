# TEST — informe vivo

## Hecho (últimas 24 h)
- Sesión 1: migración v2 sembrada, `baseline-e2e` (6 personas, 35 PASS/2 FAIL), `e2e-golden-path` (14/14), `e2e-doble-lanzamiento` (8/8), `tiempo-instalacion-readme` (install 10,1 s frío · build 24 s), hallazgos H-001..H-005.
- Sesión 2 — `e2e-seguridad-http`: `tests/e2e/seguridad-http.e2e.mjs`, **35/35 OK** sobre standalone de main (con fixes de SEG), BD dedicada `db/e2e-seguridad.db`, puertos 3115/4415. Dos fases:
  · Fase A (modo abierto): CSRF — cross-host/`Origin: null`/`text/plain` cross-site → 403; sin Origin y same-host → admitidos. Topes: autopilot 2 KB→413, campaigns 5 KB→413; chunked 8 KB→413 y chunked 16 B→200 (H-001). Login abierto→400, JSON inválido→400. SSRF: IMDS y metadata.google.internal→403. Rate limit: 7ª petición→429, GET no limitado, la campaña en curso termina COMPLETED.
  · Fase B (ADMIN_TOKEN): sin credencial→401 (incl. chunked, caso H-001), token erróneo→401, GETs abiertos→200; login erróneo→401, correcto→200 con cookie HttpOnly/SameSite=Strict/Path=/12 h (sin Secure en http); la cookie sola acredita mutaciones; logout expira (Max-Age=0); cross-origin→403 aunque el token sea válido.
- **H-001 CERRADO** (`resuelto`, verificado por TEST): los 3 puntos que pidió SEG confirmados — tope de stream chunked aplica (413), el 200 pequeño es modo abierto R4 (sin bypass), y chunked no sortea la acreditación (401). Perpetuado en security-verify (casos 9/11, SEG) y en la suite e2e (TEST).

## En curso
- Nada.

## Bloqueado
- Nada.

## Notas de verificación (para DIR/PUL)
- Comportamiento correcto pero no obvio, documentado en la suite: en `/api/auth` el cortocircuito de modo abierto (400) corre ANTES de `readJsonBody` — un cuerpo gordo en modo abierto nunca se lee (bien); el 413 del tope 1 KB solo es alcanzable con ADMIN_TOKEN (verificado en fase B).

## Peticiones a otras zonas
- IMP-1: H-002 (huérfanas 409 ≥120 s), H-003 (5/5 DRAW), H-004 (validación de lanzamiento) siguen abiertos — sin cambios esta sesión.
- IMP-2: H-005 (portada 200 con BD rota) sigue abierto — sin cambios esta sesión.
- DIR: propuesta de siguiente tarea TEST — `e2e-historial-filtros` o `e2e-exportaciones` (ambas [M], sin dependencias).

## Propuestas para el roadmap
- (TEST) perpetuar en CI las suites e2e cuando PUL añada `ci-basico`: `bun tests/e2e/golden-path.e2e.mjs` etc. son deterministas y no necesitan red.
- (TEST) `e2e-degradacion-llm` puede reutilizar el fixture del mock OpenAI de `e2e-model-studio-mock` si DIR lo aprueba (una sola pieza de arnés para dos tareas).
