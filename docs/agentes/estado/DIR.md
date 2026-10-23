# estado/DIR — Director

Actualizado: 2026-10-23 (7ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 8 commits (7832e84 → eff8d17): IMP-2 ejecutó DOS tareas cross-zone por ORDEN DIRECTA DEL PROPIETARIO (hecho de gobierno nuevo: el propietario ordena, DIR ratifica con verificación); SEG reclamó traversal-codificado-verify; TEST ya tenía e2e-autopiloto.
- `ui-pro-reactbits` tickado tras verificación DIR: React Bits oficiales SIN dependencias nuevas (package.json sin cambios), guard prefers-reduced-motion presente (matchMedia en Particles), ScenarioArt SVG determinista sustituye las 6 imágenes IA, og.png diseñada por código. Puerta DIR sobre main: lint 0 · 396/396.
- `readme-agentes-v2` (PUL) CUBIERTO por IMP-2 vía readme-visual-v2 y tickado: tabla de 6 roles v2 verificada en README, además banner SVG, badges, mermaid y galería real sin IA. El bloque PUL baja a 6 ALTA — v0.2.x se acerca.
- CORRECCIÓN de citas (3ª y 4ª a IMP-2): los 4 hashes citados en estado/IMP-2 (46b384c, 0b67312, 7d7df0e, 6b0bdc0) NO existen en main — evidencia real anotada en cada tick (e616542/c607406 y 8174b11/3982e87/047437d).
- Contador de tests obsoleto en README/badges (386 vs real 396) — petición al vigía de PUL, junto con el futuro de generate-visuals.mjs (obsoleto tras retirar las imágenes IA; OUT_DIR muerto).
- Anotaciones: pwa-og-iconos (og.png ya hecha por código) y capturas-regeneradas (nota de IMP-2).
- `traversal-codificado-verify` (SEG) cerrado y tickado con verificación DIR EN PRIMERA PERSONA: construí standalone (`bun run build`) y ejecuté el canon security-verify completo — VERDE 13/13; el fix (classify mira el path decodificado + decodeLabPart no lanzadora) hace que ambas variantes codificadas lleguen como 404 estructurado y el SIEM correlacione PATH_TRAVERSAL. Revisión del código: correcta (una pasada de decode; doble encoding queda en UNUSUAL_PATH, razonable).
- `security-verify-casos-nuevos` (SEG) cerrado en minutos y tickado: casos 14-15 (fuerza bruta DIRECTA contra /api/campaigns — la variante que pedí en la 4ª pasada — y errores-sin-fuga) — canon re-ejecutado por DIR: VERDE 15/15.
- `e2e-autopiloto` (TEST, 35/35 en tres fases) ratificado (10ª desviación): coerción estricta que cierra el bug Ronda 12, bucle real con cooldown medido y tope del cubo admin: en ráfaga. TEST se AUTO-CORRIGIÓ su cita de hashes (f1c7c9e) — primera auto-corrección de un agente.
- Nota de entorno de TEST confirmada en ROADMAP: la DATABASE_URL global del contenedor (esquema viejo, fuera del repo) gana al `.env` y envenena tests del esquema nuevo sin override — explica también los P2022 de mi clon en la 6ª pasada; anotada en ci-basico y refuerza la idea P3 de entorno fresco.

## En curso
- Claims activos: fuzz-normalizadores (SEG, 9537a15), toasts-coherentes (IMP-2, 53e479e) y refactor-engine-fases (IMP-1, 86a21f1 — partición de engine.ts sin cambio de comportamiento, tras tests-engine que sigue abierta: vigilar el orden).

## Bloqueado
- v0.2.x: quedan 6 ALTA de PUL + caddy-validate-ci + gitleaks-ci. PUL: 1 tarea cerrada en total (y la cubrió IMP-2).

## Peticiones a otras zonas
- (PUL) dos cargas servidas: contador de tests del README (386→396 + badge) y decidir generate-visuals.mjs (reconvertir a agent-browser+ffmpeg o retirarlo).
- (IMP-2) los hashes citados deben existir en main: 3ª y 4ª corrección — publica primero, cita después.
- (TODAS) el propietario puede ordenar cross-zone: documentad el orden en el claim (como hizo IMP-2) y DIR ratificará con verificación.

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 47 [x] / 156 abiertas. Por zona: SEG 19 · IMP 14 (IMP-2 8, IMP-1 6) · TEST 8 · DIR 4 · PUL 2.
- Suite unitaria: 396/396 (puerta DIR sobre main, 7ª pasada) · canon security-verify 15/15 VERDE (standalone construido y canon ejecutado DOS veces por DIR, con casos 13-15). E2E: 6 suites deterministas (14+8+35+23+24+35) · baseline 35/37.
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos.
- Desviaciones de tick directo: 10 de 10 ratificadas; TEST se auto-corrige citas (f1c7c9e) y SEG entrega con canon incluido. Correcciones de cita acumuladas por DIR: 4 (todas a IMP-2).

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
