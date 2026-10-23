# estado/DIR — Director

Actualizado: 2026-10-23 (10ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Remoto SIN commits nuevos desde el cierre de la 9ª (0397994) — los 4 claims siguen en curso sin aterrizar. Ronda dedicada a tareas propias de DIR (dos cerradas).
- `revisar-zonas` CERRADA (10ª pasada): inventario completo de src/ tras el refactor del engine — los 4 módulos engine-* caen en src/lib/sim/ (IMP-1, sin cambio de zona); reactbits/shell/layout y scenario-art bajo src/components/ (IMP-2); único hueco detectado y cerrado en OWNERSHIP: docs/banner.svg → IMP-2 (productor; og.png ya vivía en public/). Regla aclarada: refactor de código propio = dueño de la zona (precedente refactor-engine-fases); limpieza transversal = PUL.
- `aprobar-docs-nuevos` CERRADA: LOS TRES documentos proceden con condiciones, anotadas en sus tareas de PUL — ARQUITECTURA.md (momento idóneo tras el split del engine; contenido mínimo y verificable), CONTRIBUTING.md (alcance reducido, sin duplicar el protocolo multiagente), CHANGELOG.md (generado desde commits convencionales por tag de hito, conecta con sello-de-hito). El visto bueno desbloquea cuando PUL arranque; no crea urgencia.
- Idea P3 nueva: contenido-motor-en-ingles — la orden del propietario fija el idioma de producto a EN en UI/README, pero el contenido generado por el motor sigue en ES (escenarios, agentes, eventos, lecciones): producto mezclado; alineación futura en zona IMP-1 con tests de contrato de idioma.
- Higiene comprobada: docs/agentes/claims/ contiene EXACTAMENTE los 4 claims activos (los liberados se retiran — correcto); .agent-tmp/ en .gitignore (entrada duplicada, menor — para PUL).

## En curso
- Claims activos (4, sin aterrizar): e2e-volumen (TEST, 0499ff5) · ssrf-ip-pinning (SEG, 5e3f0df) · ingles-readme-dashboard (IMP-2, 510f20d — ORDEN DIRECTA DEL PROPIETARIO) · dificultad-adaptativa (IMP-1, 6f9f07e).
- Próxima pasada: eje = verificación de la traducción al inglés cuando aterrice (patrón de la 7ª: el propietario ordena, DIR ratifica con verificación — cuidar que el alcance respete el fuera-de-scope del claim: textos del motor y exportadores de IMP-1, text.ts intacto).

## Bloqueado
- v0.2.x: quedan 6 ALTA de PUL + caddy-validate-ci + gitleaks-ci. PUL: 1 tarea cerrada en total (y la cubrió IMP-2). Los 3 documentos aprobados hoy se suman a su cola.

## Peticiones a otras zonas
- (PUL) tres cargas menores añadidas: contador README/badges (386→411, ojo al choque con el claim de IMP-2), decidir generate-visuals.mjs, y entrada duplicada de .agent-tmp en .gitignore.
- (IMP-2) cuando publiques el inglés: cita hashes de main y la suite del árbol vigente (411), como acordado — el claim está bien documentado, sigue así.
- (TODAS) los documentos nuevos ya tienen visto bueno condicionado de DIR: ARQUITECTURA/CONTRIBUTING/CHANGELOG pueden entrar cuando PUL arranque, sin pedir permiso de nuevo (condiciones en el ROADMAP).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 55 [x] / 148 abiertas. Por zona: SEG 20 · IMP 18 (IMP-2 11, IMP-1 7) · TEST 9 · DIR 6 · PUL 2.
- Suite unitaria: 411/411 (última puerta DIR: 9ª pasada sobre el árbol fusionado; esta ronda docs-only, sin cambios de código) · canon vigente 15 casos. E2E: 7 suites deterministas (14+8+35+23+24+35+27).
- Hallazgos: H-001 y H-005 resueltos verificados · H-002, H-003 y H-004 abiertos.
- Desviaciones de tick directo: 15 de 15 ratificadas. Correcciones de cita acumuladas: 5 a IMP-2 + 1 obsolescencia a IMP-1.

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
