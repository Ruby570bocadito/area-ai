# estado/DIR — Director

Actualizado: 2026-10-23 (12ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Remoto SIN commits nuevos al abrir (punta: cea67d6, mi 11ª pasada) — los 4 claims siguen en vuelo. Ronda de GOBIERNO DEL CUELLO DE BOTELLA: PUL inactivo (0 sesiones, 1 tarea cerrada en todo el día y la ejecutó IMP-2) con 8 bloqueadores de v0.2.x abiertos.
- `retirar-informes-z` CERRADA POR DIR EN SU ZONA (12ª pasada; espejo del precedente security-verify-puerto): los 67 ficheros z_* viven en docs/agentes/, zona de DIR — la asignación a PUL quedaba sin efecto con PUL inactivo. Verificación antes del borrado: 67 exactos con git ls-files (17 z_bugs + 12 z_director + 17 z_implementaciones + 21 z_pulimiento), 0 referencias a z_ en PROTOCOLO/README, precondición «tras la migración del Director» cumplida desde la 1ª pasada. Tras el borrado: 0 z_* y puerta lint 0 · 411/411.
- AUTORIZACIONES CROSS-ZONE condicionales publicadas en el ROADMAP (si PUL sigue inactivo): gitleaks-ci → SEG (dominio de seguridad, ya en su cola) · caddy-validate-ci → SEG (propuesta suya) · ci-basico → TEST (su browser-e2e-ci depende de ella; conoce las notas DATABASE_URL/standalone) · script-typecheck → cualquier agente activo con claim. Regla de gobierno idéntica al patrón del propietario: claim previo, ROADMAP intacto, DIR ratifica al aterrizar.
- license-decision NO se delega — la decisión de licencia es del PROPIETARIO: pregunta formulada en el chat (qué licencia quiere; sugerencia neutra de partida: MIT si quiere máxima adopción, Apache-2.0 si quiere protección de patentes explícita).
- Seguimiento H-002 (persona admin, prioridad #2) re-verificado en código: recoverOrphanCampaigns SOLO se llama en /api/state/route.ts:16 — la sugerencia del hallazgo (arranque del servidor y/o antes del chequeo RUNNING en POST) sigue sin implementar; hallazgo vigente tal cual.
- Puerta re-ejecutada por DIR tras el borrado de los 67: lint 0 · 411/411 (14 487 expect).

## En curso
- Claims activos (4, sin aterrizar): ssrf-ip-pinning (SEG, 5e3f0df) · ingles-readme-dashboard (IMP-2, 510f20d — ORDEN DIRECTA DEL PROPIETARIO) · dificultad-adaptativa (IMP-1, 6f9f07e) · e2e-actualizacion-bd (TEST, 905a44a).
- Próxima pasada: eje = verificación de la traducción al inglés cuando aterrice (fuera-de-scope del claim: textos del motor y exportadores de IMP-1, text.ts intacto, sin diccionarios) + ratificar cualquier tarea acogida a las autorizaciones cross-zone.

## Bloqueado
- v0.2.x: de los 8 bloqueadores, quedan de PUL puro: congelar-worklog, paquete-nombre y license-decision (la decisión, no el fichero). Las otras 5 tienen ejecutor previsto (DIR ✓, TEST/SEG autorizados).

## Peticiones a otras zonas
- (PROPIETARIO) Necesito tu decisión de licencia para cerrar license-decision: ¿MIT, Apache-2.0 u otra? Es el único bloqueador que no puedo delegar.
- (SEG/TEST) Las autorizaciones cross-zone están en las tareas del ROADMAP: reclamad con claim previo y alcance documentado, como hizo IMP-2 con el inglés.
- (IMP-2) cuando publiques el inglés: hashes de main y suite del árbol vigente (411), como acordado.
- (IMP-1) H-004 restante sigue siendo el pendiente #1 de la persona «usuario torpe» (nota en el hallazgo).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 57 [x] / 146 abiertas. Por zona: SEG 20 · IMP 18 (IMP-2 11, IMP-1 7) · TEST 10 · DIR 6 · PUL 3 (1 ejecutada por IMP-2, 1 por SEG, 1 por DIR).
- Suite unitaria: 411/411 (última puerta DIR: 12ª pasada, tras el borrado) · canon 15 casos. E2E: 8 suites deterministas + 1 en reclamación.
- Hallazgos: H-001 y H-005 resueltos verificados · H-002 (re-verificado hoy), H-003 y H-004 abiertos.
- Desviaciones de tick directo: 16 de 16 ratificadas. Correcciones de cita: 5 a IMP-2 + 1 a IMP-1.

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
