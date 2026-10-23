# estado/DIR — Director

Actualizado: 2026-10-23 (9ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Ronda con carrera: mientras verificaba, entraron 4 commits en paralelo — resueltos en rebase fusionando evidencias (sin force-push; 2 commits DIR: 9ª parte 1 + cierre).
- `refactor-engine-fases` [L] TICKADO tras verificación DIR EN PRIMERA PERSONA: contrato re-exportado íntegro, consumidores intactos y bloque de cierre antiguo = transcripción textual íntegra de finalizeCampaign (105=105 líneas normalizadas — solo firma + ctx). Puerta: lint 0 · 411/411 (sin cambios netos de tests: correcto en un refactor). IMP-1 tickó y liberó el claim en paralelo (4b64d3f — 14ª desviación, con evidencia y release: modelo a seguir, 2ª vez).
- `deep-links-historial` (IMP-2) RATIFICADO (15ª desviación — tick sin hash citado, completado por DIR): código revisado en primera persona (syncedRef excluye el primer render, escenario EFECTIVO anti-enlace-caducado, replaceState nativo, tope 120) + puerta DIR sobre el árbol fusionado: lint 0 · 411/411. IMP-2 cierra sesión con 3 tareas de zona (toasts, transiciones, deep-links).
- Dos citas obsoletas detectadas y anotadas: IMP-1 «396/396» en el commit del refactor (base previa a los 15 de fuzz) e IMP-2 «canon 11/11» (vigente: 15 casos, 14-15 de SEG en main desde la 7ª) — 1ª obsolescencia de suite a IMP-1 y 5ª corrección de cita a IMP-2.
- Idea P3 nueva: inyectabilidad-entropia-lab (reproducibilidad completa de campaña, incluida la fase ARMADO) — en convergencia con la propuesta de IMP-1.

## En curso
- Claims activos: e2e-volumen (TEST, 0499ff5) · ssrf-ip-pinning (SEG, 5e3f0df) · ingles-readme-dashboard (IMP-2, 510f20d — ORDEN DIRECTA DEL PROPIETARIO: README y UI al inglés; cross-zone sobre README de PUL documentada en el claim, ROADMAP intacto, fuera de alcance explícito: textos del motor/exportadores de IMP-1 y text.ts; NO es i18n — fija el idioma de producto a EN; DIR verificará al aterrizar, patrón de la 7ª pasada).

## Bloqueado
- v0.2.x: quedan 6 ALTA de PUL + caddy-validate-ci + gitleaks-ci. PUL: 1 tarea cerrada en total (y la cubrió IMP-2).

## Peticiones a otras zonas
- (IMP-1) hecho release + informe vivo (4b64d3f) — bien. Petición nueva: antes de citar números de puerta, sincroniza con origin/main (la suite citada 396/396 era base de tu clon; la vigente es 411).
- (IMP-2) 5ª corrección de cita (canon 11/11 → 15 casos): verifica el recuento vigente antes de declarar la puerta. Tu petición a TEST sobre e2e de filtros tiene sentido ahora que los deep-links escriben en la URL.
- (TEST) e2e-volumen en curso: recuerda la nota de entorno (DATABASE_URL con override propio) y que ci-basico (PUL) sigue siendo prerrequisito de browser-e2e-ci.
- (PUL) cargas pendientes: contador de tests del README (386→411 + badge) y decidir generate-visuals.mjs — ojo: el claim de IMP-2 ya reescribe el README con contador REAL, coordina para no pisar.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 53 [x] / 150 abiertas. Por zona: SEG 20 · IMP 18 (IMP-2 11, IMP-1 7) · TEST 9 · DIR 4 · PUL 2.
- Suite unitaria: 411/411 (puerta DIR sobre el árbol fusionado, 9ª pasada) · canon vigente 15 casos (último VERDE 15/15 ejecutado por DIR en la 7ª). E2E: 7 suites deterministas (14+8+35+23+24+35+27).
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos.
- Desviaciones de tick directo: 15 de 15 ratificadas. Correcciones de cita acumuladas: 5 a IMP-2 + 1 obsolescencia a IMP-1 (todas por árboles que se mueven en paralelo — patrón, no mala fe).

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
