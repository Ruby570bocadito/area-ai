# Informe de ronda — Agente Bugs/Seguridad

## Fecha y hora
- **Fecha:** 2026-09-25 · **Hora:** 17h41 (Europe/Madrid)
- **Base de trabajo:** `2a4b411` (Ronda 4)
- **Tarea asignada por el Director (informe 17h25, D4):** versionar en el repo los tests de `target-guard` y `access`, que vivían como scripts externos del entorno.
- **Alcance anunciado:** solo tests de seguridad — sin tocar código de producto.

## Resumen
Los tests unitarios de las dos piezas de seguridad del proyecto quedan **versionados en el repo**: `tests/target-guard.test.mjs` (25 tests del guard SSRF) y `tests/access.test.mjs` (16 tests de token y rate limit). Ejecutables con `bun test tests/` (script `bun run test` añadido por Implementaciones en el mismo ciclo) e integrados como **Fase 0 del canon de verificación** `tests/smoke.mjs`. Verificación: **41/41 pass** en ~210 ms, y smoke canon completo 12/12 con la fase de campaña incluida.

## Detalle

### `tests/target-guard.test.mjs` — 25 tests
- **Portado fiel** desde el script externo (20 checks: 14 de `isPrivateIp` IPv4/IPv6 + 6 de `isLocalRequest`).
- **Ampliado** con 9 tests herméticos de `classifyTarget` (hosts de metadata, literales privados/públicos, `localhost`/`.localhost`/`.internal`/`.local`) — funciones hasta hoy sin cobertura.
- **Diseño hermético deliberado:** solo IPs literales y hostnames especiales; ninguna resolución DNS real → el test es estable y no depende de red. Esto permite ejecutarlo en Fase 0 del smoke sin penalizar el cierre de ronda.
- Formato `bun:test` en `.mjs`: cero dependencias nuevas (sin `@types/bun`), cero cambios en `tsconfig` (los `.mjs` no entran en `tsc --noEmit`), coherente con el estilo del canon `smoke.mjs`.

### `tests/access.test.mjs` — 16 tests
- **Portado fiel** el test externo del limitador (3 permitidas → bloqueada → otro cliente no afectado → expiración de ventana).
- **Ampliado** con `clientKey` (XFF primera entrada / directa) y la suite completa de `isMutationAuthorized`: modo abierto sin `ADMIN_TOKEN`, autorización por cabecera `X-Admin-Token`, por cookie `admin_token` (incluye URL-encoding), y denegación por token erróneo y por longitud distinta (el caso anti-oracle de timing).
- **Estado aislado:** claves del limitador únicas por test (el mapa es estado de módulo) y `ADMIN_TOKEN` guardado/restaurado con `afterAll` + `beforeEach` en el bloque anidado — el primer borrador fijaba el token en carga de módulo y el test de "modo abierto" lo habría borrado antes; corregido antes de la primera ejecución.

## Verificación
- `bun test tests/` → **41 pass, 0 fail, 48 expect** (211 ms).
- Smoke canon con las fases nuevas → **12/12 OK** (incluye Fase 0 de unidades y campaña end-to-end).
- `bun run lint` → 0. Sin cambios en `src/` (tsc sin necesidad de re-verificación, pero lo cubre la Fase 1 del smoke).

## Pendientes para la próxima ronda
- Con los tests ya versionados, el criterio "tests externos declarados con evidencia" del protocolo §3.6 queda obsoleto — proponer al Director retirarlo del PROTOCOLO.md en la próxima revisión.
- Cobertura futura opcional: `getCookie` con cookies múltiples y `rateLimit` con claves >1000 (limpieza perezosa) si se considera valioso.
