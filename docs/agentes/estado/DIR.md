# estado/DIR — Director

Actualizado: 2026-10-23 (14ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- SEGUNDA RONDA DE GOBIERNO DEL CUELLO DE BOTELLA (prometida en el estado de la 13ª): remoto sin commits nuevos al abrir y 0 claims en vuelo, PUL sigue inactivo — DIR ejecutó CROSS-ZONE las 2 tareas puras de PUL que bloqueaban v0.2.x, con claim previo (bb8a3d1) y puerta completa, ampliando el precedente retirar-informes-z (12ª, zona DIR propia) a ficheros de zona PUL según OWNERSHIP.
- TICK `paquete-nombre` (c9eafaa): package.json y bun.lock → «area-ai», consistencia del lock VERIFICADA con bun install --frozen-lockfile (513 paquetes, sin cambios); restos del nombre antiguo retirados por grep: «AEGIS ARENA» → «area·ai» (nombre canónico del README) en prisma/schema.prisma:11 y src/lib/sim/types.ts:2, e identificador interno __aegisLLMAlive → __areaAiLLMAlive (engine.ts:99/295, autocontenido, 0 referencias en tests).
- TICK `congelar-worklog` (6a4818b): opción «borrar» elegida y justificada — el PROTOCOLO v2 ya congelaba el fichero con el rationale «el historial lo guarda git» (§4); referencias verificadas = 0 fuera de docs/agentes; el fichero de 189 KB (última entrada pre-migración, 2ece356) tenía firmas de asistente que el PROTOCOLO §4 prohíbe; git rm + línea del PROTOCOLO actualizada.
- Puerta re-ejecutada por DIR sobre el árbol final: lint 0 · suite 480/480 (14 783 expect, IDÉNTICA a la base de la 13ª — prueba de cero cambio de comportamiento) · canon security-verify VERDE (15 casos · 42 comprobaciones).
- v0.2.x queda con UN SOLO bloqueador: license-decision (decisión del PROPIETARIO) — PUL pasa de cuello de botella a cola residual; autorizaciones cross-zone de ci-basico/caddy-validate-ci/gitleaks-ci/script-typecheck siguen vigentes.
- AMPLIACIÓN EN VIVO (3ª carrera de push de la pasada): TEST aterrizó `e2e-reinicio-servidor` (06add7d, solo tests/e2e) e IMP-1 RECLAMÓ `H-002-huerfanas-bloqueo-lanzamiento` (1fd64f3 — ¡la prioridad #1 de personas administrador/operador está en marcha!).
- `e2e-reinicio-servidor` RATIFICADO POR DIR EN PRIMERA PERSONA: suite re-ejecutada sobre build standalone fresco y puertos dedicados — 19/19 VERDE (ciclo F1-F5 completo: SIGKILL a mitad de campaña real, umbral 120 s protege a la huérfana fresca, POST 409 ×2 con H-002 vigente documentado, retrodatar +130 s → recuperación ABORTED con endedAt y eventos PRESERVADOS, POST 200 con campaña nueva COMPLETED conviviendo). TICKADO en el ROADMAP.
- 2 OBSERVACIONES DIR del tick: (1) el arnés crashea con ESRCH no capturado (:150) si el servidor spawneado muere antes del SIGKILL — el health-check no distingue «mi servidor» de un impostor en el puerto (sugerencia a TEST: vivo(pid) antes del kill + detectar bind fallido); (2) DEUDA DE HIGIENE PROPIA: un servidor residual de MI repro H-004 de la 13ª seguía en el 3115 — muerto por DIR y documentado; lección: los repros de puerto efímero se apagan en la misma sesión.

## En curso
- Vigilancia: 2 claims en vuelo (filtros-guardados/IMP-2, H-002-huerfanas-bloqueo-lanzamiento/IMP-1).
- Próxima pasada: eje = verificación EN PRIMERA PERSONA del fix H-002 de IMP-1 cuando aterrice (recoverOrphanCampaigns en POST con 409 informado — la suite de TEST ya anticipa el contrato: huérfana fresca protegida por el umbral, 409 con id y antigüedad) + filtros-guardados de IMP-2 (cuidado con no romper las aserciones EN de historial-filtros 24/24).

## Bloqueado
- license-decision: esperando la decisión del PROPIETARIO (¿MIT, Apache-2.0 u otra?) — único bloqueador no delegable de v0.2.x.

## Peticiones a otras zonas
- (PROPIETARIO) la decisión de licencia sigue pendiente + recordatorio: ROTAR el token ghp_ del chat (usado de nuevo en URL de push de un solo uso, no persistido).
- (PUL) al retomar: revisar las ejecuciones DIR de tus tareas (retirar-informes-z 12ª, congelar-worklog y paquete-nombre 14ª) — cualquier objeción, abre desviación; tu cola residual: ci-basico/caddy-validate-ci/gitleaks-ci/script-typecheck (o quien las reclame con claim) + el badge de tests del README sigue obsoleto (hoy el árbol va por 480).
- (TEST) magnífica la suite — RATIFICADA 19/19 con re-ejecución propia; dos sugerencias de endurecimiento del arnés en el tick (vivo(pid) antes del kill y detectar bind fallido al arrancar — el crash ESRCH confundió medio minuto el diagnóstico); tu zona se respetó al completo (solo tests/e2e).
- (IMP-1) H-002 en tus manos: la suite de TEST ya fija el contrato esperado (409 con id y antigüedad, umbral 120 s intacto para huérfanas frescas) — considera el molde acceptSeed del H-004; IMP-2 reclamó filtros-guardados: sin solapamiento contigo.
- (IMP-2) filtros-guardados: sin colisión conmigo; cuida no romper las aserciones EN de historial-filtros (24/24) al tocar los filtros del HistoryPanel.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 66 [x] / 138 abiertas. Por zona: SEG 22 · IMP 21 (IMP-2 12, IMP-1 9) · TEST 12 · DIR 6 · PUL 5.
- Suite unitaria: 480/480 (14 783 expect) · canon VERDE (15 casos · 42 comprobaciones) · e2e 11 suites deterministas (reinicio-servidor 19/19 se une).
- Hallazgos: H-001, H-004 y H-005 resueltos-verificados · H-002, H-003 y H-006 abiertos (H-002 con fix en vuelo de IMP-1).
- Desviaciones: 19/19 ratificadas. Correcciones de cita: 7 a IMP-2 + 1 a IMP-1.
- Prioridad de personas (permanente cobertura-personas): #1 administrador/operador (H-002 en vuelo + H-006) · #2 móvil/accesibilidad (browser-e2e-ci → ci-basico).

## Notas de proceso
- Cross-zone de DIR documentada en claims (paquete-nombre + congelar-worklog): PUL inactivo, tareas [S] mecánicas, 0 claims en vuelo, puerta completa — precedente retirar-informes-z ampliado a zona PUL. Token solo en URL de push de un solo uso; nunca persistido.
