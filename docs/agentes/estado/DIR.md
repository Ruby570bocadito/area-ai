# estado/DIR — Director

Actualizado: 2026-10-23 (13ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (últimas 24 h)
- Remoto: 7 commits nuevos — SEG liberó allowlist-e2e-standalone (514830c) y aterrizó la OLEADA DEL INGLÉS de IMP-2 (5feb1d4 + 1ae408a + 4638599 + dacd589 release + 678380e auto-corrección de hashes). Eje prometido CUMPLIDO: verificación en primera persona de la orden del propietario (patrón de la 7ª).
- Alcance del inglés 5/5: text.ts intacto (diff vacío en toda la oleada) · src/lib/ sin tocar (motor y exportadores de IMP-1) · sin sistema de diccionarios (rg i18n|dictionary|useTranslation|locales = 0) · html lang=en (layout.tsx:76) + OG/Twitter EN · semilla del motor preservada en ES (seed.ts:12) — los textos ES visibles son datos del motor, fuera de zona como declaró IMP-2. Fix 8→12 rondas verificado (control-center.tsx:258/280/288).
- DOS TICKS DIR: (1) ingles-readme-dashboard — tarea AÑADIDA a la zona IMP-2 ([M], cross-zone de README con precedente readme-visual-v2: UI ~29 ficheros EN, README íntegro, banner/og EN, galería + GIF con campañas reales sobre standalone); (2) allowlist-e2e-standalone de SEG — suite re-ejecutada POR DIR sobre standalone recién construido: 12/12 VERDE (E1 control, E2 allowlist activa, E3 URL malformada no relaja).
- Puerta re-ejecutada por DIR sobre el árbol fusionado: lint 0 · 461/461 (14 687 expect) · canon VERDE (15 casos · 42 comprobaciones) — las 9 suites e2e NO se rompieron con la UI EN.
- CORRECCIONES DE CITA (6ª y 7ª a IMP-2): (6ª) estado/IMP-2 cita «canon 11/11» — real 15 casos desde 7767cf2; (7ª) README badge/tabla dicen 411 — real 461: badge obsoleto por 3ª VEZ (386→396 en la 7ª, ahora 411→461) — petición al vigía PUL reforzada: contador que se regenere con la suite o badge automático.
- Premisa de i18n-es-en REESCRITA en el ROADMAP: la UI ya está EN sin diccionarios y el idioma de producto queda fijo (orden del propietario) — la tarea solo procede con decisión de bilingüismo; el hueco real es contenido-motor-en-ingles, que IMP-2 remitió formalmente a DIR/IMP-1 (idea reforzada en el ROADMAP).
- POR PRIMERA VEZ desde la migración: 0 claims en vuelo al cierre de la pasada.
- AMPLIACIÓN EN VIVO (5 commits durante la propia pasada, rebase limpio): IMP-1 aterrizó H-004 restante (5fd4c84 — resolverEscenario puro, SCENARIO_NOT_FOUND → 400 con eco truncado, JSON inválido → 400, rechazos antes del create, 9 tests nuevos: 461→470) y TEST aterrizó reverificar-e2e-copys-en (fdd54ea — aserciones EN en historial-filtros y volumen, único barrido que confirmó que solo esas 2 asertaban texto de UI).
- H-004 CERRADO EN PRIMERA PERSONA (3er ciclo hallazgo→fix→verificación, tras H-001 y H-005): suite re-ejecutada (470/470) + repro EN VIVO sobre standalone recién construido (BD dedicada, puerto 3115): scenarioId inexistente → 400 con el id de vuelta · JSON inválido → 400 · campaigns:[] tras ambos (cero side effects) · {} → 200 azar explícito. Matiz de precisión anotado en el hallazgo: cuerpo VACÍO con content-type JSON → 400 en runtime (JSON.parse('')) — el camino práctico del azar en vivo es {} o 'random', ambos 200. Hallazgo → resuelto-verificado.
- E2E de TEST re-ejecutadas POR DIR con build fresco: historial-filtros 24/24 · volumen 27/27 VERDE (observación menor: TEST citó 23/23 — el fichero final imprime 24). Descubrimiento de TEST (standalone stale → build fresco obligatorio) adoptado como nota en ci-basico. Puerta final del árbol fusionado: lint 0 · 470/470 (14 747 expect) · canon VERDE (15 casos · 42 comprobaciones).
- SEGUNDA AMPLIACIÓN EN VIVO (2º rebase): IMP-1 aterrizó Y TICKÓ DIRECTAMENTE `autotuning-balance` (95ee178 — veredictoAutotuning puro banda [0.4,0.6] inclusiva, script con higiene por defecto, 10 tests). RATIFICADO POR DIR como 19ª desviación (3ª de IMP-1): suite re-ejecutada 480/480 · lint 0 · script CORRIDO POR DIR (--n 1 × 6 escenarios: MUESTRA_CORTA correcta) e higiene verificada con doble conteo (campañas y knowledge INVARIANTES antes/después). RESPUESTA a su pregunta formal: NO recalibración en bucle cerrado — el script mide; ajustes de constantes manuales con tests que fijen el cambio (patrón balance-datos-archivo).

## En curso
- Sin claims propios ni ajenos. Vigilancia: aterrizajes acogidos a las autorizaciones cross-zone (gitleaks-ci, caddy-validate-ci, ci-basico, script-typecheck) — ratificaré con verificación al llegar.
- Próxima pasada: si PUL sigue inactivo, segunda ronda de gobierno del cuello de botella (evaluar ejecutar otra tarea de PUL en zona compartida según el precedente retirar-informes-z) + verificación de cualquier aterrizaje cross-zone + seguimiento H-002/H-006 en IMP-1 (ahora la prioridad #1 de personas).

## Bloqueado
- license-decision: esperando la decisión del PROPIETARIO (único bloqueador no delegable).
- v0.2.x bloqueadores restantes de PUL: congelar-worklog y paquete-nombre (PUL inactivo; autorizaciones cross-zone publicadas y vigentes).

## Peticiones a otras zonas
- (PROPIETARIO) la decisión de licencia sigue pendiente: ¿MIT, Apache-2.0 u otra? + recordatorio: ROTAR el token ghp_ del chat.
- (PUL) el badge/contador del README ha quedado obsoleto 3 veces — al retomar, propón contador automático; mientras tanto, corregir 411→461 (hoy el árbol va por 480).
- (IMP-1) H-004 CERRADO — magnífico el molde acceptSeed aplicado textual. autotuning-balance RATIFICADO (19ª): tu pregunta formal está respondida en el tick — el script mide, la recalibración de constantes es manual con tests. Nuevo pendiente #1 de la persona «administrador/operador»: H-002 (recoverOrphanCampaigns solo en /api/state: arranque del servidor o chequeo pre-POST) y H-006 (escenario sin nodos aborta en silencio). Matiz del reader anotado en el hallazgo H-004 (no bloquea).
- (TEST) e2e re-verificadas por DIR (24/24 + 27/27 con build fresco) — el descubrimiento del standalone stale ya está como nota en ci-basico; la oferta de verificar H-004 quedó cubierta por DIR (gracias igualmente).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 63 [x] / 141 abiertas. Por zona: SEG 22 · IMP 21 (IMP-2 12, IMP-1 9) · TEST 11 · DIR 6 · PUL 3.
- Suite unitaria: 480/480 (14 783 expect) · canon VERDE (15 casos · 42 comprobaciones) · e2e 10 suites deterministas (14+8+35+24+24+35+27+27+26+12; historial-filtros 24 tras las aserciones EN).
- Hallazgos: H-001, H-004 y H-005 resueltos-verificados · H-002, H-003 y H-006 abiertos.
- Desviaciones: 19/19 ratificadas. Correcciones de cita: 7 a IMP-2 + 1 a IMP-1 (observación menor no numerada: TEST citó 23/23, el fichero final imprime 24).
- Prioridad de personas (permanente cobertura-personas): #1 administrador/operador (H-002 + H-006, IMP-1) · #2 móvil/accesibilidad (browser-e2e-ci → ci-basico) · «usuario torpe» CERRADO con H-004.

## Notas de proceso
- Token usado solo en URL de push de un solo uso; nunca persistido. Recordatorio al propietario: rotar el ghp_ del chat.
