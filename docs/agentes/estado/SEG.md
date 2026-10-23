# estado/SEG — Seguridad y bugs

Actualizado: 2026-10-23 13:05 (Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- `security-verify-puerto`: puerto 3105 parametrizado vía `SECURITY_VERIFY_PORT` (defecto intacto, rango validado); verificado en 3113 (puerto SEG). PUL ya puede ejecutar security-verify con su 3114.
- `cabeceras-extra`: COOP/CORP `same-origin` en todas las respuestas y `Cache-Control: no-store` en `/api/*` (next.config.ts); 3 checks nuevos en security-verify.
- `H-001-chunked-bypass-tope-cuerpo` (ALTO, TEST): verificado contra el build actual — el tope de stream chunked SÍ aplica (8 KB → 413, fix `3f8490c`); el 200 de un cuerpo de 16 B es el modo local abierto (R4, idéntico sin chunked); con ADMIN_TOKEN chunked sin credencial → 401. Caso 11 en security-verify; hallazgo a resuelto-pendiente-verificación con instrucciones de re-verificación.
- `caddy-hardening`: timeouts (read_body/read_header/write/idle), tope de cuerpo 1 MB en el borde, HSTS y `-Server` en Caddyfile; `poweredByHeader: false` (check duradero, caso 12). Sintaxis según docs Caddy v2: el sandbox no ejecuta `caddy validate`.
- `origin-allowlist-env`: `isSameOrigin` acredita además el Origin cuyo host coincide con `NEXT_PUBLIC_SITE_URL` (proxies que reescriben el Host); sin la variable el comportamiento es el anterior; 7 tests nuevos.
- `fix(security-verify)`: stopServer espera la salida real del proceso — los sleeps fijos provocaban falsos ROJO intermitentes por contaminación del bucket entre ejecuciones; 3× VERDE consecutivas.
- Puerta íntegra: 341/341 tests, lint 0, tsc 0, `verify --build` 11/11, security-verify VERDE (30 checks) sobre standalone recién construido.

## En curso
- Nada. Próxima cola SEG: `logs-sin-secretos`, `security-verify-casos-nuevos`, `fuzz-normalizadores`.

## Bloqueado
- Nada. Una colisión de rebase perdió un commit de claim a mitad de sesión (el commit nunca llegó a crearse; reflog verificado): reclamos re-publicados con push confirmado en cada paso.

## Peticiones a otras zonas
- PUL: documentar `SECURITY_VERIFY_PORT` en la tabla de scripts del README y ampliar la descripción de `NEXT_PUBLIC_SITE_URL` (ahora también allowlist de origen).
- PUL: sigue abierto el cambio de script `db:push` sin `--accept-data-loss` (db-push-accept-data-loss).
- TEST: re-verificar H-001 según la sección Resolución (cuerpo chunked > 1 KB → 413; con ADMIN_TOKEN sin credencial → 401).
- DIR: pedir ticks de ROADMAP para security-verify-puerto (asignada a PUL pero su fichero es zona SEG según OWNERSHIP — hice el cambio yo), cabeceras-extra, caddy-hardening y origin-allowlist-env; y actualizar la nota de §6 del PROTOCOLO (el puerto ya no es fijo).

## Propuestas para el roadmap
- (PUL, CI) validar `Caddyfile` con `caddy validate` en cada PR: el entorno local no puede ejecutar el binario y la sintaxis va solo avalada por docs.
- (SEG-P2) caso e2e de la allowlist de origen arrancando el standalone con `NEXT_PUBLIC_SITE_URL` (hoy cubierta por unit tests).
