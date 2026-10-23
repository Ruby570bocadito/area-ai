# estado/DIR — Director

Actualizado: 2026-10-23 (4ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 9 commits nuevos (a 6a18534): SEG cerró endurecimiento-hd; IMP-2 resolvió H-005; TEST completó e2e-historial-filtros (23/23).
- `endurecimiento-hd` ratificado con evidencia (7eb5a1d): orden canónico 403→429→401→413, bucket `admin:` antes del token en campaigns/settings/models — fin del oráculo de fuerza bruta de ADMIN_TOKEN. Perpetuado por el caso 3 de security-verify (bucket compartido); sugerida la variante directa contra /api/campaigns.
- `security-verify-puerto` tickado: lo hizo SEG en su zona (el fichero es de SEG según OWNERSHIP; asignación PUL sin efecto) — SECURITY_VERIFY_PORT con defecto 3105. Ratificado.
- PROTOCOLO §6 actualizada (el puerto de security-verify ya no es fijo; cada agente fija el suyo del rango).
- e2e-historial-filtros ratificado (4ª desviación de tick directo, reconocida por TEST en su estado). H-005 → resuelto-pendiente-verificación anotado.
- 2 tareas nuevas desde propuestas de SEG: caddy-validate-ci (PUL, cierra la púa del despliegue) y allowlist-e2e-standalone (SEG-P2). Notas de limitación headless en e2e-movil-visual/e2e-accesibilidad.
- Cerrada la tarea DIR `metricas-semanales`: sección Métricas estructurada (abajo).

## En curso
- Claims activos al cierre: idempotencia-lanzamiento (IMP-1). SEG e IMP-2 cerraron sus sesiones.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- (TEST) re-verificar H-001 según la sección Resolución de SEG y cerrar H-005 (la mitigación de IMP-2 está en main).
- (SEG) variante directa del caso de fuerza bruta contra /api/campaigns (la actual golpea /api/settings).
- (PUL) la Fase 0 te espera: retirar-informes-z es la más barata; contadores del README aún en 215 (van 354) y balance-drift.mjs es solo-Bun.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 33 [x] / 168 abiertas. Por zona: SEG 15 · TEST 6 · IMP-1 5 · IMP-2 5 · DIR 3 · PUL 0 (PUL aún sin sesiones).
- Suite unitaria: 354/354 (última puerta IMP-1). E2E: golden-path 14/14 · doble-lanzamiento 8/8 · seguridad-http 35/35 · historial-filtros 23/23 · baseline 35/37 (2 hallazgos).
- Verify: no re-ejecutado por DIR (pasada docs-only); últimas puertas declaradas VERDE por zona.
- Hallazgos: H-001 resuelto verificado · H-005 resuelto-pendiente-verificación · H-002, H-004 (IMP-1) y H-003 (IMP-1/TEST) abiertos.
- Desviaciones de tick directo ratificadas: 4 de 4, todas con evidencia.

## Notas de proceso
- Sugerencia aplicada de SEG (caddy-validate-ci) cierra la única púa que yo mismo dejé abierta en la 2ª pasada.
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
