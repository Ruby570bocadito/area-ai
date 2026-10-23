# estado/DIR — Director

Actualizado: 2026-10-23 (8ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 2 commits (08cc1c1 → d7eb4ba): IMP-2 completó toasts-coherentes; TEST reclamó e2e-entorno-adverso.
- `toasts-coherentes` tickado tras verificación DIR: código revisado (política única — auto-cierre AVISO 6 s / ERROR 9 s / RESULTADO 12 s, puerta única toastError() para destructivos, copys «No se pudo …», override explícito respeta al llamador) + puerta lint 0 · 396/396. Claim SIN release — petición a IMP-2. Nota: estados-vacios-e2e puede cobijar el caso e2e del auto-cierre.
- Gobernanza comprobada: `tests-engine` ya está [x] — el claim refactor-engine-fases de IMP-1 respeta la dependencia declarada ("solo tras tests-engine").

## En curso
- Claims activos: refactor-engine-fases (IMP-1, 86a21f1), e2e-entorno-adverso (TEST, e072e44), toasts-coherentes (IMP-2 — trabajo hecho, falta release), fuzz-normalizadores (SEG, 9537a15).

## Bloqueado
- v0.2.x: quedan 6 ALTA de PUL + caddy-validate-ci + gitleaks-ci. PUL: 1 tarea cerrada en total (y la cubrió IMP-2).

## Peticiones a otras zonas
- (IMP-2) publica `chore(claim): release toasts-coherentes` — misma formalidad que IMP-1 en la 6ª pasada. Y sigue: cita SOLO hashes de main (4 correcciones acumuladas).
- (PUL) dos cargas servidas: contador de tests del README (386→396 + badge) y decidir generate-visuals.mjs (reconvertir a agent-browser+ffmpeg o retirarlo).
- (TODAS) el propietario puede ordenar cross-zone: documentad el orden en el claim (como hizo IMP-2) y DIR ratificará con verificación.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 48 [x] / 155 abiertas. Por zona: SEG 19 · IMP 15 (IMP-2 9, IMP-1 6) · TEST 8 · DIR 4 · PUL 2.
- Suite unitaria: 396/396 (puerta DIR sobre main, 8ª pasada) · canon security-verify 15/15 VERDE (standalone construido y canon ejecutado DOS veces por DIR, con casos 13-15). E2E: 6 suites deterministas (14+8+35+23+24+35) · baseline 35/37.
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos.
- Desviaciones de tick directo: 10 de 10 ratificadas; TEST se auto-corrige citas (f1c7c9e) y SEG entrega con canon incluido. Correcciones de cita acumuladas por DIR: 4 (todas a IMP-2).

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
