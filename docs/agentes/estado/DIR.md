# estado/DIR — Director

Actualizado: 2026-10-23 (11ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Remoto con 1 commit nuevo al abrir (905a44a): TEST reclamó `e2e-actualizacion-bd` — diseño de arnés SÓLIDO (schema anterior reconstruido DESDE GIT, 3 fases: arranque sin migrar → recuperación por el camino documentado → app actualizada; apagado por PID). Sin aterrizajes de los 3 claims en vuelo.
- Ronda dedicada a la tarea permanente `cobertura-personas` con VERIFICACIÓN EN PRIMERA PERSONA del estado de H-004 (persona «usuario torpe»): sigue VIGENTE en 2 de 3 casos — `scenarioId` inexistente degrada a escenario aleatorio EN SILENCIO (engine.ts:141, `find(...) ?? rand(scenarios)`) y JSON malformado también degrada (campaigns/route.ts); solo seed/determinista devuelven 400 (seed-determinista). Nota DIR añadida al hallazgo: el argumento «promesa rota» que el propio código esgrime para la semilla aplica TEXTUAL al escenario.
- Priorización de personas publicada (anotada en la tarea): 1º usuario torpe (H-004 restante — barato: el patrón acceptSeed ya existe) · 2º administrador/operador (H-002 + e2e-reinicio-servidor abierto) · 3º móvil/accesibilidad (bloqueadas por browser-e2e-ci → ci-basico de PUL).
- Idea P3 nueva: healthcheck-esquema-bd — el ping de GET /api solo hace db.setting.count(): con BD de versión anterior reporta db:up VERDE (observado por TEST en la fase 1 de su claim, verificado por DIR en el código, src/app/api/route.ts); sonda barata contra columna reciente → P2022 = schema 'outdated'. Nace de evidencia de TEST — tercer ciclo propuesta de agent → idea DIR.
- Puerta re-ejecutada por DIR sobre main: lint 0 · 411/411 (14 487 expect) — pulso VERDE sin aterrizajes.

## En curso
- Claims activos (4): ssrf-ip-pinning (SEG, 5e3f0df) · ingles-readme-dashboard (IMP-2, 510f20d — ORDEN DIRECTA DEL PROPIETARIO) · dificultad-adaptativa (IMP-1, 6f9f07e) · e2e-actualizacion-bd (TEST, 905a44a).
- Próxima pasada: eje = verificación de la traducción al inglés cuando aterrice (patrón de la 7ª: el propietario ordena, DIR ratifica con verificación — cuidar el fuera-de-scope del claim: textos del motor y exportadores de IMP-1, text.ts intacto, sin sistema de diccionarios).

## Bloqueado
- v0.2.x: quedan 6 ALTA de PUL + caddy-validate-ci + gitleaks-ci. PUL: 1 tarea cerrada en total (y la cubrió IMP-2). Los 3 documentos aprobados ayer-ronda siguen esperando a que PUL arranque.

## Peticiones a otras zonas
- (IMP-1) H-004 restante es el pendiente #1 de la persona «usuario torpe»: 400 si `scenarioId` no existe (el fallback aleatorio que quede EXPLÍCITO) y 400 en JSON malformado — el patrón acceptSeed es el precedente y el molde; cabe dentro de dificultad-adaptativa o justo después.
- (IMP-2) cuando publiques el inglés: cita hashes de main y la suite del árbol vigente (411), como acordado.
- (TEST) tu observación de observabilidad del claim (healthcheck ciego al esquema) ya es idea P3 en el ROADMAP (healthcheck-esquema-bd) — buena caza.
- (PUL) contador README/badges: ojo al choque con el claim de IMP-2 (lo reescribe en EN con contador real).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 56 [x] / 147 abiertas. Por zona: SEG 20 · IMP 18 (IMP-2 11, IMP-1 7) · TEST 10 · DIR 6 · PUL 2.
- Suite unitaria: 411/411 (última puerta DIR: 11ª pasada, esta ronda) · canon vigente 15 casos. E2E: 8 suites deterministas (14+8+35+23+24+35+27+27) + 1 en reclamación (actualizacion-bd).
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos (H-004 re-verificado hoy: vigente 2/3 casos).
- Desviaciones de tick directo: 16 de 16 ratificadas. Correcciones de cita acumuladas: 5 a IMP-2 + 1 obsolescencia a IMP-1.

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
