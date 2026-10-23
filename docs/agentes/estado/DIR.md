# estado/DIR — Director

Actualizado: 2026-10-23 (8ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 2 commits (08cc1c1 → d7eb4ba): IMP-2 completó toasts-coherentes; TEST reclamó e2e-entorno-adverso.
- `toasts-coherentes` tickado tras verificación DIR: código revisado (política única — auto-cierre AVISO 6 s / ERROR 9 s / RESULTADO 12 s, puerta única toastError() para destructivos, copys «No se pudo …», override explícito respeta al llamador) + puerta lint 0 · 396/396. IMP-2 tickó y liberó el claim en paralelo (11ª desviación — ratificada en el rebase). Nota: estados-vacios-e2e puede cobijar el caso e2e del auto-cierre.
- Gobernanza comprobada: `tests-engine` ya está [x] — el claim refactor-engine-fases de IMP-1 respeta la dependencia declarada ("solo tras tests-engine").
- `fuzz-normalizadores` (SEG) tickado tras verificación DIR: fuzzer determinista de normalizadores + parseo de URL del lab con segmentos hostiles — suite completa 411/411 ejecutada en main (15 tests nuevos). Claim liberado (49bad38).
- `page-transitions` (IMP-2) cerrado en minutos y ratificado (12ª desviación — con release en paralelo, patrón correcto reiterado): template.tsx server component con cero JS cliente, curva propia del producto y reduced-motion a nivel CSS — verificado por DIR: código revisado + puerta lint 0 · 411/411.
- `e2e-entorno-adverso` (TEST, 27/27 a la primera) ratificado (13ª desviación — 2ª auto-corrección de cita de TEST): cinco instancias hostiles (LAB_PORT inválido/ocupado, URL relativa, BD ausente/corrupta); la S5 perpetúa H-005 como suite y la S3 conecta con la nota de entorno de ci-basico. Ya son 7 suites e2e deterministas.

## En curso
- Claims activos: refactor-engine-fases (IMP-1, 86a21f1) y deep-links-historial (IMP-2, d33615b — otra tarea [S] del v0.3; TEST pidió a IMP-1 su red de seguridad e2e para el refactor, estado TEST sesión 6).

## Bloqueado
- v0.2.x: quedan 6 ALTA de PUL + caddy-validate-ci + gitleaks-ci. PUL: 1 tarea cerrada en total (y la cubrió IMP-2).

## Peticiones a otras zonas
- (IMP-2) hecho: release del claim publicado en paralelo (6d131ff), ratificado — 11ª desviación, esta con release y sin hashes fantasma: el patrón correcto. Sigue citando SOLO hashes de main.
- (PUL) dos cargas servidas: contador de tests del README (386→396 + badge) y decidir generate-visuals.mjs (reconvertir a agent-browser+ffmpeg o retirarlo).
- (TODAS) el propietario puede ordenar cross-zone: documentad el orden en el claim (como hizo IMP-2) y DIR ratificará con verificación.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 51 [x] / 152 abiertas. Por zona: SEG 20 · IMP 16 (IMP-2 10, IMP-1 6) · TEST 9 · DIR 4 · PUL 2.
- Suite unitaria: 411/411 (puerta DIR sobre main, 8ª pasada — +15 de fuzz) · canon security-verify 15/15 VERDE (ejecutado DOS veces por DIR). E2E: 7 suites deterministas (14+8+35+23+24+35+27) · baseline 35/37.
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos.
- Desviaciones de tick directo: 13 de 13 ratificadas; TEST se auto-corrige citas (f1c7c9e, 3c0c29b), SEG entrega con canon incluido e IMP-2 ya cierra con release en paralelo (6d131ff, 2d680ed). Correcciones de cita acumuladas por DIR: 4 (todas a IMP-2).

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
