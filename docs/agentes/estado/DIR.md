# estado/DIR — Director

Actualizado: 2026-10-23 (12ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Remoto SIN commits nuevos al abrir (punta: cea67d6, mi 11ª pasada) — los 4 claims en vuelo. Ronda de GOBIERNO DEL CUELLO DE BOTELLA: PUL inactivo (0 sesiones, 1 tarea cerrada en todo el día y la ejecutó IMP-2) con 8 bloqueadores de v0.2.x abiertos.
- `retirar-informes-z` CERRADA POR DIR EN SU ZONA (12ª pasada; espejo del precedente security-verify-puerto): los 67 ficheros z_* viven en docs/agentes/, zona de DIR — la asignación a PUL quedaba sin efecto con PUL inactivo. Verificación antes del borrado: 67 exactos con git ls-files (17 z_bugs + 12 z_director + 17 z_implementaciones + 21 z_pulimiento), 0 referencias a z_ en PROTOCOLO/README, precondición «tras la migración del Director» cumplida desde la 1ª pasada. Tras el borrado: 0 z_* y puerta lint 0 · 411/411.
- AUTORIZACIONES CROSS-ZONE condicionales publicadas en el ROADMAP (si PUL sigue inactivo): gitleaks-ci → SEG (dominio de seguridad, ya en su cola) · caddy-validate-ci → SEG (propuesta suya) · ci-basico → TEST (su browser-e2e-ci depende de ella; conoce las notas DATABASE_URL/standalone) · script-typecheck → cualquier agente activo con claim. Regla de gobierno idéntica al patrón del propietario: claim previo, ROADMAP intacto, DIR ratifica al aterrizar.
- license-decision NO se delega — la decisión de licencia es del PROPIETARIO: pregunta formulada en el chat (qué licencia quiere; sugerencia neutra de partida: MIT si quiere máxima adopción, Apache-2.0 si quiere protección de patentes explícita).
- Seguimiento H-002 (persona admin, prioridad #2) re-verificado en código: recoverOrphanCampaigns SOLO se llama en /api/state/route.ts:16 — la sugerencia del hallazgo (arranque del servidor y/o antes del chequeo RUNNING en POST) sigue sin implementar; hallazgo vigente tal cual.
- CARRERA durante la publicación: IMP-1 aterrizó `dificultad-adaptativa` (59148c7 — feat con 25 tests, suite 411→436). Rebase limpio (mis cambios eran docs-only) y VERIFICACIÓN DIR EN PRIMERA PERSONA sobre el árbol fusionado: núcleo puro pace.ts (banda [0.85,1.15], muestra mínima 5, empates sin señal, normalizarAjuste como fuente única), contrato de congelado (startCampaign:150 → fila → runCampaign:305), escalado cero-suma en combate (:434-435 y :584), POST {adaptativa:false} con 400, PATCH_BONUS_COMPROMETIDO extraído con criterio documentado y neutro de serie en determinista (reproducibilidad preservada). Puerta re-ejecutada por DIR: lint 0 · 436/436 · db push en sync. TICKADO POR DIR — nota en el tick: el claim de IMP-1 seguía sin liberar al cerrar la pasada; su tick/release se ratificará al llegar (patrón de la 14ª desviación).
- Segunda carrera del cierre: tick+release de IMP-1 llegó en paralelo al tick DIR (1d6ad7f) — RATIFICADO AL LLEGAR como 18ª desviación (renumerada: la 17ª es el tick de TEST que llegó en la tercera carrera; patrón de la 14ª: evidencia + release en el mismo momento, 3ª vez de IMP-1). Su evidencia e2e (standalone con BD efímera: ajuste 1,15 congelado con anuncio, neutro sin anuncio en determinista, 400 con 'sí') fusionada con mi verificación en la línea única del tick (conflicto resuelto en rebase). IMP-1 resolvió además el conflicto del ROADMAP con mi 11ª leyendo ficheros completos — la disciplina de resolución de conflictos cala.
- TERCERA CARRERA (6 commits): TEST aterrizó `e2e-actualizacion-bd` (2e368fa/53624c2/d2f65a6 — 26/26 ×3 + H-006 de regalo) y SEG aterrizó `ssrf-ip-pinning` en dos piezas (0e8f40f + d0ed313 + release a674a0c, SIN tick propio). Verificación DIR EN PRIMERA PERSONA de ambas: suite de TEST re-ejecutada sobre standalone recién construido — 26/26 OK (F1 schema antiguo desde git, F2 degradación clasificada sin fuga, F3 push sin --force con históricas preservadas, F4 campaña determinista nueva completa; apagado por PID) — ratificada (17ª desviación, 3ª de TEST); safeFetch de SEG revisado (resuelve UNA vez, clasifica, conecta a la IP fijada; https sobre node:tls con SNI/cert al nombre; fail-closed; sin redirects; códigos acotados), integración en models:115 y llm.ts:111 confirmada — TICKADO POR DIR con lint 0 · 461/461 (436+25) y canon security-verify VERDE COMPLETO (15 casos) — cierre de R13.
- H-006 NUEVO (TEST, robustez MEDIO, dirigido a IMP-1): el motor aborta en silencio con un escenario cuya infrastructure no trae nodos (POST 200 → ~2 s → ABORTED con causa solo en log del servidor; camino de entrada: BD de otra versión/instancia o edición manual). Sugerencia: validar/excluir en startCampaign o degradación controlada en runCampaign. Cuadra con la priorización de personas (persona: operador con BD migrada).
- Puerta final del árbol: lint 0 · 461/461 · canon 15/15 · e2e actualizacion-bd 26/26 re-ejecutada por DIR.

## En curso
- Claim activo (1): ingles-readme-dashboard (IMP-2, 510f20d — ORDEN DIRECTA DEL PROPIETARIO). Claims de ssrf-ip-pinning, e2e-actualizacion-bd y dificultad-adaptativa LIBERADOS correctamente — higiene impecable de claims hoy.
- Próxima pasada: eje = verificación de la traducción al inglés cuando aterrice (fuera-de-scope del claim: textos del motor y exportadores de IMP-1, text.ts intacto, sin diccionarios) + ratificar cualquier tarea acogida a las autorizaciones cross-zone.

## Bloqueado
- v0.2.x: de los 8 bloqueadores, quedan de PUL puro: congelar-worklog, paquete-nombre y license-decision (la decisión, no el fichero). Las otras 5 tienen ejecutor previsto (DIR ✓, TEST/SEG autorizados).

## Peticiones a otras zonas
- (PROPIETARIO) Necesito tu decisión de licencia para cerrar license-decision: ¿MIT, Apache-2.0 u otra? Es el único bloqueador que no puedo delegar.
- (SEG/TEST) Las autorizaciones cross-zone están en las tareas del ROADMAP: reclamad con claim previo y alcance documentado, como hizo IMP-2 con el inglés.
- (IMP-2) cuando publiques el inglés: hashes de main y suite del árbol vigente (461 tras los aterrizajes de la 12ª), como acordado.
- (IMP-1) H-004 restante sigue siendo el pendiente #1 de la persona «usuario torpe» (nota en el hallazgo).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 60 [x] / 143 abiertas. Por zona: SEG 21 · IMP 19 (IMP-2 11, IMP-1 8) · TEST 11 · DIR 6 · PUL 3 (1 ejecutada por IMP-2, 1 por SEG, 1 por DIR).
- Suite unitaria: 461/461 (última puerta DIR: 12ª pasada, tras los tres aterrizajes) · canon 15 casos VERDE (re-ejecutado por DIR). E2E: 9 suites deterministas (14+8+35+23+24+35+27+27+26).
- Hallazgos: H-001, H-005 y H-006 (nuevo, TEST→IMP-1) · H-002 (re-verificado hoy), H-003 y H-004 abiertos.
- Desviaciones de tick directo: 18 de 18 ratificadas. Correcciones de cita: 5 a IMP-2 + 1 a IMP-1.

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
