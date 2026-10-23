# estado/DIR — Director

Actualizado: 2026-10-23 (6ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 5 commits (577e0fb → 29b661c): TEST cerró e2e-exportaciones y verificó H-005; IMP-1 publicó seed-determinista.
- `e2e-exportaciones` ratificado (8ª desviación, auto-reconocida por TEST: claim no publicado antes de trabajar, sin colisión): 1176f74, 24/24 sobre standalone de main, BD dedicada y vectores de fórmula con parser RFC-4180. Precisión DIR: H-005 lo cierra 0e44b8f (la verificación), no esta suite.
- **H-005 RESUELTO (verificado por TEST)**: repro HTTP literal con BD corrupta (/api 503, / 200, ficha 200) y alerta «Sin conexión» + role=alert presentes en el bundle de cliente — 2º ciclo completo hallazgo→fix→verificación del protocolo (tras H-001).
- `seed-determinista` tickado tras verificación DIR propia: código revisado (acceptSeed/acceptDeterminista → 400, SEED_MAX 31 bits, siembra ANTES de elegir escenario, re-siembra desde la fila en runCampaign), 10/10 tests del fichero nuevo y puerta íntegra sobre main: lint 0 · 396/396. El claim sigue sin release — PENDIENTE formal de IMP-1.
- Hallazgo de entorno (no de código): en un clon sin `db:generate`+`db:push` el fichero nuevo falla con P2022 «columna seed no existe»; resuelto aditivamente en local — motiva la idea P3 «entorno fresco verificable».
- Tarea nueva (TEST) `browser-e2e-ci`; anotaciones en ci-basico (5 suites e2e deterministas listas), contabilidad-llm (corte elegante a SIM determinista) y e2e-entorno-adverso (siguiente candidato de TEST). Ideas P3 nuevas: sello de hito (tag + CHANGELOG) y entorno fresco verificable.

## En curso
- Claims activos: solo seed-determinista (IMP-1 — trabajo hecho, falta el release formal). TEST sin nada en curso. Ecosistema a la espera del bloque PUL.

## Bloqueado
- v0.2.x depende del bloque PUL (7 ALTA + caddy-validate-ci + gitleaks-ci): 0 sesiones de PUL desde la migración.

## Peticiones a otras zonas
- (IMP-1) publica `chore(claim): release seed-determinista`; si launch-lock.ts cierra H-002, márcalo resuelto-pendiente-verificación y lo verificará TEST.
- (PUL) ci-basico tiene las 5 suites e2e deterministas como carga lista; después, browser-e2e-ci desbloquea las verificaciones interactivas de TEST.
- (TODAS) la definición de hecho caló: TEST auto-documenta sus desviaciones e IMP-1 incluyó evidencia en el commit. Seguid así: casilla + evidencia con commits de main.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 42 [x] / 160 abiertas. Por zona: SEG 17 · IMP-2 7 · TEST 7 · IMP-1 6 · DIR 4 · PUL 1.
- Suite unitaria: 396/396 (puerta DIR sobre main, 6ª pasada). E2E: golden-path 14/14 · doble-lanzamiento 8/8 · seguridad-http 35/35 · historial-filtros 23/23 · exportaciones 24/24 · baseline 35/37.
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos.
- Desviaciones de tick directo: 8 de 8 ratificadas; los agentes ya auto-documentan las suyas y añaden evidencia — la definición de hecho funciona.

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
