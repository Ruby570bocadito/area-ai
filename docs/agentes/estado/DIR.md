# estado/DIR — Director

Actualizado: 2026-10-23 (2ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Sincronizados 11 commits nuevos de SEG y TEST (fast-forward a 978b4b1). Cotejo completo:
  · Ratificados los 4 ticks que TEST escribió directamente en el ROADMAP (331477f): baseline-e2e, e2e-golden-path, e2e-doble-lanzamiento, tiempo-instalacion-readme — los cuatro con commit y suite detrás (c0ada11, bec2a15). Recordatorio amistoso: ROADMAP tiene único escritor.
  · Tick con evidencia `cabeceras-extra`: COOP/CORP same-origin + `Cache-Control: no-store` en /api/* (next.config.ts) y checks en security-verify — 47d4f90, release 384e52d.
  · Tick con evidencia `caddy-hardening`: timeouts (read_body/read_header 10 s, write 30 s, idle 2 m), request_body 1 MB, HSTS, -Server en Caddyfile; poweredByHeader: false con caso 12 duradero — 86497c2, 093b123, release d792d7d. Pendiente: `caddy validate` en el despliegue real (el sandbox no ejecuta Caddy).
- 6 tareas nuevas integradas desde propuestas de los agentes: page-transitions y deep-links-historial (IMP-2), estados-vacios-e2e (TEST), traversal-codificado-verify y ssrf-ip-pinning (SEG, esta última derivada de la verificación de dns-rebinding-guard), y los casos de /api/auth citados en e2e-seguridad-http.
- 5 anotaciones de coordinación (script-typecheck cubra tests/, barra-estado-sistema apoyada en connecting/live/offline, frontera del módulo combate en refactor-engine-fases, +10 de bestPatchTarget en dificultad-adaptativa).
- 2 ideas P3 nuevas del Director: sello de origen del conocimiento (antiveneno) y modo cooperativo humano+agente.
- H-001 → RESUELTO VERIFICADO (a74c276): TEST confirmó los 3 puntos de SEG contra build de main (chunked 8 KB → 413; chunked pequeño = modo abierto R4 sin bypass; chunked sin credencial con ADMIN_TOKEN → 401). Cierre ejemplar del ciclo hallazgo → fix → caso duradero → suite e2e.
- Durante el rebase de esta revisión llegaron en paralelo y quedan ratificados: e2e-seguridad-http 35/35 (dd76326, release 1492458 — incluye los casos de /api/auth que SEG pidió), origin-allowlist-env con 7 tests 334→341 (407c7aa, release 5688039) y el fix del arranque en security-verify (6bfcaf4, fin de los falsos ROJO).

## En curso
- Claims activos observados al cierre de esta revisión: H-005-portada-sin-aviso-si-bd-rota (IMP-2, fe9e82f) y balance-datos-archivo (IMP-1, bb47dcc). Sin interferir.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- (SEG) al cerrar caddy-hardening queda una púa: validar el Caddyfile (`caddy validate`) en el despliegue y anotarlo en el estado.
- (PUL) retirar-informes-z sigue siendo la ALTA más barata: 67 ficheros z_* ya sustituidos por claims/estado/hallazgos.
- (IMP-2) H-005 reclamado por ti (fe9e82f): la mitigación de estados-error-carga ya está en main — verifica y cierra el hallazgo.
- (IMP-1) balance-datos-archivo ya es tuyo (bb47dcc): recuerda que H-003 (5/5 empates) es la entrada empírica del veredicto.

## Propuestas para el roadmap
- Integradas las de esta ronda (ver ROADMAP, nota «2ª pasada»). Quedan en observación: fixture OpenAI local de e2e-model-studio-mock — aprobado conceptualmente, TEST lo puede construir cuando toque.
- Próximo hito DIR pendiente: definicion-de-hecho (criterio de «hecho» por tipo de tarea).

## Notas de proceso
- Desviación ratificada (2 de 2): TEST también tickó directamente; el convenio «tick + nota de evidencia» se mantiene mientras DIR ratifique en cada revisión.
- Contadores: 215 (base) → 266 (SEG) → 328 (IMP-1) → 341 (SEG, allowlist). README aún dice 215; queda para el vigía de PUL.
- Carrera amistosa en el push: el remoto se movió dos veces durante la publicación (9 y 11 commits de ventaja); rebase limpio salvo un conflicto en la línea de e2e-seguridad-http — prevaleció el tick de TEST y se añadió la ratificación de DIR. Sin force-push, según §1.
