# estado/DIR — Director

Actualizado: 2026-10-23 (14ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- SEGUNDA RONDA DE GOBIERNO DEL CUELLO DE BOTELLA (prometida en el estado de la 13ª): remoto sin commits nuevos al abrir y 0 claims en vuelo, PUL sigue inactivo — DIR ejecutó CROSS-ZONE las 2 tareas puras de PUL que bloqueaban v0.2.x, con claim previo (bb8a3d1) y puerta completa, ampliando el precedente retirar-informes-z (12ª) a ficheros de zona PUL según OWNERSHIP.
- TICK `paquete-nombre` (c9eafaa): package.json y bun.lock → «area-ai», consistencia del lock VERIFICADA (bun install --frozen-lockfile: 513 paquetes, sin cambios); restos del nombre antiguo retirados por grep: «AEGIS ARENA» → «area·ai» (prisma/schema.prisma:11, src/lib/sim/types.ts:2) e identificador interno __aegisLLMAlive → __areaAiLLMAlive (engine.ts:99/295, autocontenido, 0 referencias en tests).
- TICK `congelar-worklog` (6a4818b): opción «borrar» elegida y justificada — el PROTOCOLO v2 ya congelaba el fichero («el historial lo guarda git», §4); 0 referencias fuera de docs/agentes; el fichero de 189 KB (última entrada pre-migración, 2ece356) tenía firmas de asistente que el PROTOCOLO §4 prohíbe; git rm + PROTOCOLO:51 actualizado.
- 4 CARRERAS DE PUSH EN UNA SOLA PASADA (la pasada más activa del día): entre carrera y carrera aterrizaron TEST e2e-reinicio-servidor (06add7d + auto-tick 41a31a3), IMP-2 filtros-guardados (2309c5f + release 35c2c90), IMP-1 FIX DE H-002 (f4dd715 + 885c082) y el claim de H-006 (528912e). Rebase con conflicto en la línea del tick de TEST — resuelto fusionando ambas evidencias (patrón de la 12ª).
- `e2e-reinicio-servidor` RATIFICADO POR DIR (19/19 ×2 ejecuciones propias: sobre el árbol sin fix en puertos 3116/4416 y sobre el árbol CON el fix H-002 en 3117/4417, siempre con build standalone fresco). 2 observaciones DIR en el tick: (1) el arnés crashea con ESRCH no capturado (:150) si el servidor spawneado muere antes del SIGKILL — el health-check no distingue «mi servidor» de un impostor en el puerto (sugerencia a TEST: vivo(pid) antes del kill + detectar bind fallido); (2) DEUDA DE HIGIENE PROPIA documentada: un servidor residual de MI repro H-004 de la 13ª seguía en el 3115 — muerto por DIR; lección: los repros de puerto efímero se apagan en la misma sesión.
- H-002 → RESUELTO-VERIFICADO (4º ciclo completo hallazgo→fix→verificación, tras H-001, H-004 y H-005): código del fix revisado línea a línea (route.ts: `await recoverOrphanCampaigns()` ANTES del chequeo RUNNING, idempotente, umbral 120 s intacto; 409 ahora con campaignId + enCursoDesde; engine.ts:120-130 adjunta ambos al throw), suite 499/499 y repro del ciclo en vivo con la suite de TEST contra el árbol con fix. Nota DIR en el hallazgo.
- TICK `filtros-guardados` de IMP-2 RATIFICADO (zona verificada: hook nuevo + panel + tests, compartidas text.ts/api-types INTACTAS; premisas del claim en el código: useSyncExternalStore + getServerSnapshot SSR-seguro, clave area-ai.saved-filters.v1, topes 8/40/120/80, listener storage; 15 tests).
- Puerta DIR sobre el árbol final: lint 0 · suite 499/499 (14 837 expect) · canon security-verify VERDE (15 casos · 42 comprobaciones, ejecutado en la fase propia de la pasada).
- v0.2.x queda con UN SOLO bloqueador: license-decision (decisión del PROPIETARIO) — PUL pasa de cuello de botella a cola residual.

## En curso
- Vigilancia: claim H-006 (IMP-1, 528912e — el motor aborta en silencio con escenario sin nodos) + IMP-2 anuncia `enlace-permanente-ronda` (claim a continuación).
- Próxima pasada: eje = verificación EN PRIMERA PERSONA del fix H-006 cuando aterrice (validación de infraestructura con error explícito — la suite e2e-actualizacion-bd de TEST documentó el silencio original) + enlace-permanente-ronda de IMP-2 + revisar el badge de tests del README si PUL no aparece (hoy 499, el badge quedó en 411).

## Bloqueado
- license-decision: esperando la decisión del PROPIETARIO (¿MIT, Apache-2.0 u otra?) — único bloqueador no delegable de v0.2.x.

## Peticiones a otras zonas
- (PROPIETARIO) la decisión de licencia sigue pendiente + recordatorio: ROTAR el token ghp_ del chat (usado de nuevo en URLs de push de un solo uso, no persistido).
- (PUL) al retomar: revisar las ejecuciones DIR de tus tareas (retirar-informes-z 12ª, congelar-worklog y paquete-nombre 14ª) — cualquier objeción, abre desviación; cola residual: ci-basico/caddy-validate-ci/gitleaks-ci/script-typecheck (o quien las reclame) + badge de tests obsoleto (411 → real 499).
- (TEST) suite RATIFICADA 19/19 ×2 por DIR — sugerencias de endurecimiento del arnés en el tick (vivo(pid) antes del kill, detectar bind fallido); el fix H-002 de IMP-1 ya está verificado: tu aserción de 409 con huérfana fresca sigue siendo correcta (el umbral protege a las vivas).
- (IMP-1) H-002 CERRADO — diseño impecable (recuperación conservadora antes del chequeo + 409 informado). H-006 en tus manos: considera el patrón de error clasificado sin fuga que ya usaste en e2e-actualizacion-bd (500 clasificado).
- (IMP-2) filtros-guardados RATIFICADO — la tienda SSR-segura es el patrón a replicar; enlace-permanente-ronda: sin colisión, recuerda las aserciones EN de historial-filtros (24/24).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 67 [x] / 137 abiertas. Por zona: SEG 22 · IMP 22 (IMP-2 13, IMP-1 9) · TEST 12 · DIR 6 · PUL 5.
- Suite unitaria: 499/499 (14 837 expect) · canon VERDE (15 casos · 42 comprobaciones) · e2e 11 suites deterministas (reinicio-servidor 19/19 se une).
- Hallazgos: H-001, H-002, H-004 y H-005 resueltos-verificados (4 ciclos completos) · H-003 y H-006 abiertos (H-006 con fix en vuelo de IMP-1).
- Desviaciones: 19/19 ratificadas. Correcciones de cita: 7 a IMP-2 + 1 a IMP-1.
- Prioridad de personas (permanente cobertura-personas): #1 administrador/operador (solo H-006 pendiente, en vuelo) · #2 móvil/accesibilidad (browser-e2e-ci → ci-basico).

## Notas de proceso
- Cross-zone de DIR documentada en claims (paquete-nombre + congelar-worklog): PUL inactivo, tareas [S] mecánicas, 0 claims en vuelo, puerta completa — precedente retirar-informes-z ampliado a zona PUL. Las citas de mis propios hashes post-rebase se corrigieron antes de publicar (la disciplina de citas aplica también a DIR). Token solo en URL de push de un solo uso; nunca persistido.
