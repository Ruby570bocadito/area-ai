# ROADMAP — area-ai

Único escritor: DIR. Los demás roles proponen vía "Propuestas" en su `estado/<ID>.md`.
Archivo pensado para `docs/agentes/ROADMAP.md`. Formato de tarea: `- [ ] (ID destino) slug — [talla] descripción — rutas`.

> **Revisión DIR 2026-10-23 (ratificación):** la migración v2 y los 20 ticks con evidencia quedan ratificados tras cotejo con git log y el árbol; la colisión con mi propia migración duplicada se adjudicó sin pérdida (prevaleció e7f0fe4, §7.1). Se añaden 7 tareas — endurecimiento-hd y test-superficie-mutaciones (SEG), tokens-hex-restantes, higiene-bd-llm y engines-bun (PUL), balance-datos-archivo e idempotencia-lanzamiento (IMP-1) —, la idea P3 modo espectador y el conteo de informes z_* corregido a 67. Puerta de calidad re-ejecutada por DIR sobre este árbol antes de publicar (lint + suite unitaria en verde).

> **Revisión DIR 2026-10-23 (2ª pasada):** sincronizados 11 commits nuevos de SEG y TEST. Ratificados los 4 ticks que TEST escribió directamente aquí (331477f; los cuatro con commit y suite detrás — recordar que el único escritor de este archivo es DIR). Ticks con evidencia: `cabeceras-extra` y `caddy-hardening` (este último con `caddy validate` pendiente del despliegue). Entran 6 tareas nuevas nacidas de propuestas (`page-transitions`, `deep-links-historial`, `estados-vacios-e2e`, `traversal-codificado-verify`, `ssrf-ip-pinning` y los casos de `/api/auth` citados en `e2e-seguridad-http`), anotaciones de coordinación en 5 tareas existentes y 2 ideas P3 nuevas del Director. Durante el propio rebase de esta revisión quedan ratificados los cierres que llegaron en paralelo: `e2e-seguridad-http` (TEST, 35/35, cierra H-001 con SEG — a74c276 lo pasa a «resuelto verificado»), `origin-allowlist-env` (SEG, 407c7aa) y el fix del arranque en security-verify (6bfcaf4). Claims nuevos al cierre: `H-005-portada-sin-aviso-si-bd-rota` (IMP-2), `balance-datos-archivo` (IMP-1).

> **Revisión DIR 2026-10-23 (3ª pasada):** ratificado el tick directo de `balance-datos-archivo` de IMP-1 (36240a6: módulo puro + script SOLO LECTURA + 19 tests de frontera; DIR verificó `bun scripts/balance-drift.mjs --json` sobre BD local: veredicto SIN_DATOS limpio y salida 0 — el veredicto de H-003 lo emitirá el script al alcanzar 15+ archivadas en D30). `idempotencia-lanzamiento` en curso (claim 0341dc4). Cerrada la tarea DIR `definicion-de-hecho`: bloque «Qué significa [x]» tras la leyenda — desde esta revisión, un tick sin evidencia no se ratifica. Nueva idea P3: panel de gobernanza en vivo.

> **Revisión DIR 2026-10-23 (4ª pasada):** endurecimiento-hd ratificado (7eb5a1d: orden canónico 403→429→401→413 y bucket `admin:` antes del token en campaigns/settings/models — fin del oráculo de fuerza bruta; perpetuado por el caso 3 de security-verify contra el bucket compartido, con variante directa contra /api/campaigns sugerida). security-verify-puerto hecho por SEG en su zona (convenio OWNERSHIP respetado) y ratificado; §6 del PROTOCOLO actualizada (puerto ya no fijo). Ratificados el tick de e2e-historial-filtros de TEST (23/23, 4ª desviación documentada) y el cierre de H-005 (resuelto-pendiente-verificación). Entraron 2 tareas desde propuestas de SEG (caddy-validate-ci, allowlist-e2e-standalone) y notas de limitación headless en las e2e visuales. Cerrada la tarea DIR metricas-semanales.

**Leyenda**
- Talla: `[S]` ≤ 1 tarea corta · `[M]` una tarea completa con tests · `[L]` partir en piezas funcionales por sí solas (cada pieza = su propio slug).
- Prioridad por sección: **P0** bloquea a todos o es riesgo real · **P1** siguiente fase · **P2** valor alto, sin urgencia · **P3** ideas grandes / exploratorias.
- `[verificar]` = hipótesis sacada de leer el repo, sin comprobar. El dueño la confirma (con test o prueba reproducible) antes de implementar; si no se confirma, borra la tarea y lo anota en su estado.
- Estado de partida (v0.2.1): 6 escenarios, 10 agentes (5 RED / 5 BLUE), laboratorio HTTP real en 127.0.0.1, 215 tests unitarios, smoke de 17 comprobaciones, sin CI, sin `loading.tsx` / `error.tsx` / `not-found.tsx`, sin tema claro ni i18n, sin tests unitarios dedicados para `engine.ts`, `lab/runtime.ts`, `lab/ops.ts`, `progression.ts`, `knowledge-score.ts`, `provider-config.ts`.
- Regla que nunca se rompe: todo ataque/defensa ocurre contra el laboratorio local (127.0.0.1). Ninguna idea de este documento autoriza apuntar a hosts externos.

**Qué significa `[x]`** (definición de hecho, DIR 2026-10-23; DIR la comprueba en cada revisión y no ratifica ticks sin evidencia)
- **feature** — código + tests propios + puerta íntegra (lint, suite, `verify --build` en producto) + claim released.
- **fix** — lo anterior + el caso de regresión perpetuado (test o caso de `security-verify`), no solo el parche.
- **refactor** — comportamiento idéntico: suite verde antes y después, sin cambios de API visible.
- **UI** — incluye estados vacío/error/carga coherentes y `verify --build` con caché limpia si tocó mucho CSS (D27).
- **seguridad** — además, caso duradero en `security-verify` o test que perpetúe la corrección.
- **docs / análisis** — evidencia citada (commit, script ejecutado o informe) y ratificación de DIR en la siguiente pasada.

**Fases y versiones**
| Fase | Objetivo | Versión |
|------|----------|---------|
| 0 | Migrar al protocolo v2, CI, red de seguridad de tests, estados de error/carga | — |
| 1 | Robustez + UX base (accesibilidad, tema, móvil, tiempo real) | v0.3 |
| 2 | Profundidad de producto (replay, comparativas, nuevos escenarios, ranking) | v0.4 |
| 3 | Plataforma (escenarios definidos por el usuario, informes, datasets, despliegue) | v1.0 |

---

## ALTA — hacer primero (Fase 0)

- [x] (DIR) migracion-protocolo-v2 — [M] publicar PROTOCOLO v2 + OWNERSHIP, crear `claims/ estado/ hallazgos/`, volcar solo los riesgos abiertos a este archivo — docs/agentes/
- [ ] (PUL) retirar-informes-z — [S] borrar `docs/agentes/z_*` (67 archivos: 12 director, 17 implementaciones, 21 pulimiento, 17 bugs; el «68» contaba también el PROTOCOLO antiguo, ya sustituido) tras la migración del Director — docs/agentes/
- [ ] (PUL) congelar-worklog — [S] `worklog.md`: comprobar referencias, borrar o dejar como histórico sin más entradas; quitar firmas de asistente y el nombre antiguo "AEGIS ARENA" — worklog.md
- [ ] (PUL) readme-agentes-v2 — [S] sustituir la tabla "Agentes del proyecto" por los 6 roles y rutas nuevas — README.md
- [ ] (PUL) ci-basico — [M] workflow con `bun install`, lint, `bun run test` y typecheck en push/PR; caché de bun — .github/workflows/
- [ ] (PUL) caddy-validate-ci — [S] validar el Caddyfile con `caddy validate` en cada PR; la sintaxis actual va solo avalada por los docs de Caddy v2 (el sandbox no ejecuta el binario; propuesta de SEG que cierra la púa pendiente del despliegue) — .github/workflows/, Caddyfile
- [ ] (PUL) script-typecheck — [S] añadir `typecheck` (`tsc --noEmit`) a `package.json` para CI y agentes — package.json · nota IMP-1: que el tsconfig cubra también `tests/*.test.ts`
- [ ] (PUL) paquete-nombre — [S] renombrar `nextjs_tailwind_shadcn_ts` a `area-ai` y buscar restos de nombres antiguos con grep — package.json, src/
- [ ] (PUL) license-decision — [S] el repo se presenta como open source pero no hay `LICENSE` en la raíz: pedir al dueño qué licencia y añadirla — LICENSE, README.md
- [x] (SEG) db-push-accept-data-loss — [S] `db:push` usa `--accept-data-loss`: documentar el riesgo y proponer migraciones (`prisma migrate`) para cualquier cambio de esquema con datos — package.json, prisma/ (cambio de script vía PUL) · hecho 2026-10-23: riesgo documentado en README (Seguridad); el cambio de script sigue abierto para PUL
- [x] (SEG) csv-formula-injection — [M] las exportaciones CSV incluyen comandos y evidencia controlados por el lab: neutralizar celdas que empiecen por `=`, `+`, `-`, `@` y test de regresión — src/lib/event-export.ts, src/lib/knowledge-export.ts, src/lib/aggregate-report.ts
- [x] (SEG) prompt-injection-evidencia — [M] la evidencia del lab (respuestas HTTP) llega a los prompts del LLM que genera lecciones: acotar longitud, escapar delimitadores y validar la salida con esquema — src/lib/sim/llm.ts, src/lib/sim/engine.ts · hecho 2026-10-23: verificado y cerrado con `sanitizeForPrompt` (src/lib/text.ts) aplicado en los 4 puntos de prompt de engine.ts + acotes de action/detail almacenados; la validación de esquema ya existía en saveLessons (coerción + clamp)
- [x] (IMP-1) tests-engine — [L] red de seguridad antes de refactorizar: tests del motor con RNG sembrado (elección de agentes por fase, momentum RED, respuesta BLUE, progreso siempre en [0,100]) — src/lib/sim/engine.ts, tests/
- [x] (IMP-1) tests-lab-runtime — [L] tests del runtime del lab (política de red por niveles, sesiones, firewall, parcheo, clasificación de firmas) con servidor efímero en puerto libre — src/lib/lab/runtime.ts, src/lib/lab/ops.ts, tests/
- [x] (IMP-1) tests-progresion-conocimiento — [M] tests de `progression.ts`, `knowledge-score.ts` y `provider-config.ts` — src/lib/sim/, tests/
- [x] (IMP-2) estados-error-carga — [M] añadir `loading.tsx`, `error.tsx` y `not-found.tsx` (global y por ruta principal) con estilo coherente — src/app/
- [x] (IMP-2) skeletons-polling — [M] esqueletos mientras `/api/state` carga por primera vez y estado "sin conexión / reintentando" cuando el sondeo falla — src/hooks/use-arena-state.tsx, src/components/arena/
- [x] (TEST) baseline-e2e — [M] primera pasada completa por las 4 personas mínimas y primeros hallazgos; fijar la línea base de tiempos del README en frío — tests/e2e/, docs/agentes/hallazgos/

---

## IMP-2 — Frontend / UX

### Global y shell (P1)
- [ ] (IMP-2) tema-claro-oscuro — [L] tema claro además del oscuro con tokens en `globals.css` y `arena-colors.ts`, conmutador persistido, respetar `prefers-color-scheme` — src/app/globals.css, src/lib/arena-colors.ts, src/components/arena/shell/
- [ ] (IMP-2) accesibilidad-base — [L] auditoría y arreglos: `aria-label` en controles icónicos, foco visible, orden de tabulación, contraste AA, landmarks, `aria-live="polite"` en el feed de eventos — src/components/arena/
- [x] (IMP-2) reduced-motion — [M] respetar `prefers-reduced-motion` en framer-motion, partículas, haces del mapa y NumberFlow — src/components/arena/, src/app/globals.css
- [ ] (IMP-2) page-transitions — [S] transición compartida entre rutas con `template.tsx`; barata ahora que `MotionConfig reducedMotion="user"` ya envuelve toda la app (propuesta de IMP-2) — src/app/
- [ ] (IMP-2) i18n-es-en — [L] extraer textos de UI a diccionarios y ofrecer inglés (los textos están en español en los componentes); `lang` dinámico — src/components/, src/app/layout.tsx
- [x] (IMP-2) barra-estado-sistema — [M] indicador permanente de salud (BD, lab, proveedor LLM, modo determinista activo) usando el healthcheck `GET /api` — src/components/arena/shell/app-shell.tsx · hecho 2026-10-23: panel «Sistema» en el sidebar (compartido con el drawer móvil) con filas BD (Operativa/Caída clasificada con el healthcheck solo tras fallo del sondeo), Lab HTTP (en línea :puerto / fuera de línea) y Motor LLM (proveedor + aviso «Determinista» cuando la campaña en pantalla arrancó en SIM); `dbStatus` en use-arena-state y `engineMode?: string` aditivo en CampaignSummaryDTO (compartido); chips de conexión coherentes con el 503 (H-005). Puerta: lint 0 · 354/354 · canon 11/11 — f1a5939 (commit del panel) y 953cf88 (chips de conexión de H-005)
- [ ] (IMP-2) paleta-comandos-v2 — [M] ampliar `⌘K`: ir a campaña por id, lanzar escenario concreto, activar autopiloto, cambiar tema/idioma, buscar lecciones y agentes — src/components/arena/command-palette.tsx
- [ ] (IMP-2) atajos-teclado — [S] overlay de ayuda (`?`) con todos los atajos y navegación por teclado entre secciones — src/components/arena/shell/
- [ ] (IMP-2) onboarding-primera-visita — [M] recorrido de 4-5 pasos (qué es RED/BLUE, fases, cómo se decide la victoria) descartable y recordado por navegador — src/components/arena/
- [ ] (IMP-2) pagina-ayuda-glosario — [M] `/ayuda` con fases MITRE, tipos de nodo, firmas detectadas, regla de victoria (explicando `victory.ts`) y FAQ — src/app/ayuda/
- [ ] (IMP-2) pagina-ajustes — [M] `/ajustes`: rondas por defecto, intervalo y presupuesto del autopiloto, tema, idioma, retención de datos — src/app/ajustes/
- [ ] (IMP-2) toasts-coherentes — [S] unificar copys, duración y acciones de los avisos (campaña terminada, error de red, exportación lista) — src/components/ui/, src/components/arena/
- [x] (IMP-2) estados-vacios — [S] estados vacíos con guía de siguiente paso en historial, conocimiento, analítica y agente sin actividad — src/components/arena/
- [ ] (IMP-2) rendimiento-bundle — [M] analizar el bundle, `dynamic()` para gráficos y mapa, evitar renders del sondeo global en páginas que no lo usan — src/app/, src/hooks/
- [ ] (IMP-2) pwa-og-iconos — [S] manifest, iconos por tamaño y imagen Open Graph estática coherente con la marca — public/, src/app/
- [ ] (IMP-2) auditoria-movil — [M] pasada de usabilidad a 360/390/768 px en todas las páginas (tablas con scroll, menús, mapa táctil) — src/components/arena/, src/app/
- [ ] (IMP-2) catalogo-componentes-dev — [M] página solo en desarrollo con todos los componentes y estados (carga, vacío, error) para revisión visual — src/app/dev/ui/

### Panel de mando — `src/app/page.tsx`, `control-center.tsx`
- [ ] (IMP-2) tarjetas-escenario-ricas — [M] cada escenario muestra dificultad, duración estimada, objetivos y un mini-mapa de su red antes de lanzar — src/components/arena/control-center.tsx
- [ ] (IMP-2) configurar-campana — [L] configuración avanzada previa al lanzamiento: preset de rondas (rápida 6 / estándar 12), selección de agentes por equipo, semilla, motor LLM o determinista — src/components/arena/control-center.tsx (requiere API de IMP-1)
- [x] (IMP-2) confirmacion-lanzamiento — [S] confirmación ligera y protección contra doble clic al lanzar campaña — src/components/arena/control-center.tsx
- [ ] (IMP-2) kpis-panel — [M] KPIs clicables (victorias RED/BLUE, racha, conocimiento nuevo 14 d, tiempo medio) con deep-links a historial/analítica — src/app/page.tsx
- [ ] (IMP-2) atajo-ultima-campana — [S] tarjeta "continuar donde lo dejaste" con la última campaña y su resultado — src/app/page.tsx

### Arena en vivo — `arena-live.tsx`, `event-feed.tsx`
- [ ] (IMP-2) stepper-fases-mitre — [M] barra de progreso de las 6 fases con ronda actual y resultado por fase — src/components/arena/arena-live.tsx
- [ ] (IMP-2) filtros-feed — [M] filtrar el feed por equipo, resultado, nodo y firma; pausar auto-scroll; "saltar a lo último" — src/components/arena/event-feed.tsx
- [ ] (IMP-2) eventos-fijables — [S] fijar eventos clave y verlos en una columna lateral — src/components/arena/event-feed.tsx
- [ ] (IMP-2) marcador-sparkline — [S] marcador con mini-curva de progreso ronda a ronda — src/components/arena/arena-live.tsx
- [ ] (IMP-2) modo-presentacion — [M] pantalla completa para proyector con tipografía grande, sin controles — src/app/arena/
- [ ] (IMP-2) replay-campana — [L] reproducir una campaña finalizada con línea de tiempo, velocidad x1/x2/x4 y salto por ronda (usa eventos guardados) — src/app/historial/[id]/, src/components/arena/ (depende de `replay-api`)
- [ ] (IMP-2) sonido-opcional — [S] efectos discretos opcionales (desactivados por defecto) para compromiso/parche/fin — src/components/arena/arena-live.tsx

### Mapa de red — `network-map.tsx`
- [ ] (IMP-2) mapa-zoom-pan — [M] zoom, arrastre y minimapa; pinch en táctil — src/components/arena/network-map.tsx
- [ ] (IMP-2) panel-nodo — [M] cajón lateral al pulsar un nodo: sesiones, parches, tráfico con status, firmas detectadas, historial de estado — src/components/arena/network-map.tsx
- [ ] (IMP-2) capas-mapa — [M] alternar capas: segmentos, criticidad, ruta de ataque, cobertura defensiva, kill-chain por fase — src/components/arena/network-map.tsx
- [ ] (IMP-2) leyenda-mapa — [S] leyenda explícita de colores/iconos y estados (comprometido, endurecido, aislado) — src/components/arena/network-map.tsx
- [ ] (IMP-2) mapa-teclado — [M] navegación por teclado entre nodos y anuncio de estado a lectores de pantalla — src/components/arena/network-map.tsx

### Agentes — `roster.tsx`, `agent-detail.tsx`
- [ ] (IMP-2) radar-habilidades — [M] gráfico radar de habilidades y especialidad por fase — src/components/arena/agent-detail.tsx
- [ ] (IMP-2) historial-xp-agente — [S] curva de XP/nivel y win rate por escenario en la ficha — src/components/arena/agent-detail.tsx
- [ ] (IMP-2) comparar-agentes — [M] vista de dos agentes lado a lado y matriz de enfrentamientos RED×BLUE — src/components/arena/roster.tsx
- [ ] (IMP-2) timeline-actividad — [S] línea de tiempo de la actividad real del agente con filtros por campaña — src/components/arena/agent-detail.tsx

### Conocimiento — `knowledge-panel.tsx`
- [ ] (IMP-2) chips-tags-filtros — [S] filtros por chips de categoría/tags con contadores — src/components/arena/knowledge-panel.tsx
- [ ] (IMP-2) historial-confianza — [M] mini-curva de la confianza de cada lección a lo largo de las campañas — src/components/arena/knowledge-panel.tsx
- [ ] (IMP-2) vista-grafo-lecciones — [L] grafo de relaciones entre lecciones (misma categoría, misma campaña, usadas juntas) — src/components/arena/knowledge-panel.tsx
- [ ] (IMP-2) fijar-archivar-leccion — [M] fijar/archivar lecciones desde la UI (requiere API) — src/components/arena/knowledge-panel.tsx
- [ ] (IMP-2) mapa-calor-uso — [S] mapa de calor de uso por categoría y equipo — src/components/arena/knowledge-panel.tsx

### Historial — `history-panel.tsx`, `historial/[id]`
- [ ] (IMP-2) lista-virtualizada — [M] paginación o virtualización cuando el archivo crece; mantener búsqueda tolerante a acentos — src/components/arena/history-panel.tsx
- [ ] (IMP-2) deep-links-historial — [S] filtros del historial en la URL con el patrón D6 (`useSearchParams` en componente propio dentro de `<Suspense>`, validación contra lista blanca); precede a filtros-guardados (propuesta de IMP-2) — src/components/arena/history-panel.tsx
- [ ] (IMP-2) filtros-guardados — [S] guardar y nombrar combinaciones de filtros (persistencia local) — src/components/arena/history-panel.tsx
- [ ] (IMP-2) comparar-campanas — [L] comparar 2-3 campañas seleccionadas (progreso, fases, agentes, lecciones) — src/components/arena/campaign-analysis.tsx, src/app/historial/
- [ ] (IMP-2) acciones-masivas — [M] selección múltiple: exportar, archivar y borrar con confirmación (requiere API) — src/components/arena/history-panel.tsx
- [ ] (IMP-2) notas-y-etiquetas — [M] notas y etiquetas por campaña (requiere esquema) — src/app/historial/[id]/page.tsx
- [ ] (IMP-2) vista-imprimible — [S] estilos de impresión para la ficha y el informe — src/app/historial/[id]/page.tsx, src/app/globals.css
- [ ] (IMP-2) enlace-permanente-ronda — [S] deep-link a una ronda o evento concreto dentro de la ficha — src/app/historial/[id]/page.tsx

### Analítica — `analytics.tsx`
- [ ] (IMP-2) rango-fechas — [S] selector de rango y comparación con el periodo anterior — src/components/arena/analytics.tsx
- [ ] (IMP-2) mapa-calor-fases — [M] mapa de calor de éxito por fase y escenario — src/components/arena/analytics.tsx
- [ ] (IMP-2) cobertura-mitre — [L] vista de cobertura por táctica/técnica (depende de `mapeo-mitre`) — src/components/arena/analytics.tsx
- [ ] (IMP-2) llm-vs-determinista — [M] comparar rendimiento de campañas con LLM frente a modo determinista — src/components/arena/analytics.tsx
- [ ] (IMP-2) panel-consumo-llm — [M] llamadas, tokens y coste estimado por proveedor (depende de `contabilidad-llm`) — src/components/arena/analytics.tsx

### Model Studio — `model-studio.tsx`
- [ ] (IMP-2) probar-conexion — [S] botón "Probar" con latencia y error legible antes de guardar — src/components/arena/model-studio.tsx
- [ ] (IMP-2) modelo-por-equipo — [M] asignar un modelo a RED y otro a BLUE (depende de `llm-por-equipo`) — src/components/arena/model-studio.tsx
- [ ] (IMP-2) benchmark-modelos — [L] lanzar la misma batería de campañas con dos modelos y comparar (depende de `torneos-y-benchmarks`) — src/components/arena/model-studio.tsx
- [ ] (IMP-2) gestion-presets — [S] presets guardables y ordenables por el usuario — src/components/arena/model-studio.tsx

---

## IMP-1 — Motor, laboratorio, API y datos

### Motor de campañas (P1-P2)
- [x] (IMP-1) balance-datos-archivo — [S] veredicto de deriva del balance (D30, coste cero en LLM — no lanzar campañas nuevas) con las campañas ya archivadas: distribución de ganadores y progresos finales; solo una deriva persistente (≥70 % del mismo ganador en 15+ campañas) abre recalibración formal de pace.ts — scripts/, src/lib/sim/ (reparto de la Ronda 12 sin ejecutar, rescatado por DIR) · hecho 2026-10-23: módulo puro `balance-drift.ts` + script SOLO LECTURA `scripts/balance-drift.mjs` (--json/--dias) + 19 tests de frontera (21/30 = 70 % exacto); e2e de IMP-1 con datos efímeros detecta DERIVA_RED 94,4 %; DIR replicó sobre BD local: SIN_DATOS limpio — 36240a6, release eb575c3 · tick directo de IMP-1 ratificado por DIR (3ª desviación del convenio: sin nota de evidencia)
- [x] (IMP-1) idempotencia-lanzamiento — [S] [verificar] dedupe en servidor de POST /api/campaigns repetidos (ventana corta con el mismo cuerpo o Idempotency-Key): cierre de servidor del doble clic — el cerrojo de confirmacion-lanzamiento es solo cliente — src/app/api/campaigns/route.ts · hecho 2026-10-23: hipótesis CONFIRMADA con repro (6 POST concurrentes → 2 campañas RUNNING simultáneas, TOCTOU findFirst→create); cierre en dos piezas — cerrojo de lanzamiento en el motor (launch-lock.ts, check+create en serie) y dedupe en la ruta (Idempotency-Key con replay 10 min + hash de cuerpo en ventana 5 s, solo 200 archivados); repro post-fix: 6 POST concurrentes → 1 campaña y 5×409, replay con la misma key devuelve el mismo campaignId — 1d30db0/8ec02ee, claim 0341dc4 · ratificado por DIR (5ª desviación del convenio — en este caso con evidencia incluida: modelo a seguir)
- [ ] (IMP-1) seed-determinista — [M] semilla por campaña guardada en BD para reproducir una campaña idéntica en modo determinista — src/lib/sim/engine.ts, prisma/schema.prisma
- [ ] (IMP-1) refactor-engine-fases — [L] partir `engine.ts` (936 líneas) en módulos (selección, rondas, combate, cierre) sin cambiar comportamiento; solo tras `tests-engine` — src/lib/sim/ · nota IMP-1: `redShouldChain` y `accumulateProgress` (ya extraídos y testados) son la frontera natural del módulo «combate»
- [ ] (IMP-1) dificultad-adaptativa — [M] ajustar fuerza de la defensa según el historial de victorias del escenario, con tope y desactivable — src/lib/sim/pace.ts, src/lib/sim/engine.ts · nota IMP-1: calibrar el +10 hardcodeado de bestPatchTarget (prioriza comprometidos y criticidad)
- [ ] (IMP-1) autotuning-balance — [M] script que lanza N campañas deterministas y reporta tasa de victoria por escenario (objetivo orientativo 40-60 %) — scripts/, src/lib/sim/pace.ts
- [ ] (IMP-1) ranking-elo — [M] puntuación tipo ELO por agente y por emparejamiento, mostrada en analítica — src/lib/sim/progression.ts
- [ ] (IMP-1) memoria-por-agente — [L] cada agente recupera lecciones relevantes a su especialidad y fase con presupuesto de tokens — src/lib/sim/engine.ts, src/lib/sim/knowledge-score.ts
- [ ] (IMP-1) personalidades-agente — [M] rasgos que sesgan decisiones (cauto, agresivo, sigiloso) visibles en la ficha — src/lib/sim/roster.ts, src/lib/sim/engine.ts
- [ ] (IMP-1) cancelar-pausar-reanudar — [L] cancelar, pausar y reanudar campañas en curso con estado consistente en BD y lab — src/lib/sim/engine.ts, src/app/api/campaigns/[id]/
- [ ] (IMP-1) cola-de-campanas — [M] cola con límite de concurrencia en lugar de rechazar/lanzar sin orden; visible en la UI — src/lib/sim/engine.ts, src/app/api/campaigns/route.ts
- [ ] (IMP-1) recuperacion-huerfanas-v2 — [M] mejorar la recuperación de campañas huérfanas tras un reinicio (reanudar o cerrar con motivo claro) — src/lib/sim/engine.ts
- [ ] (IMP-1) autopiloto-presupuesto — [M] ventanas horarias, tope diario de campañas/llamadas LLM y parada automática — src/lib/sim/autopilot.ts, src/app/api/autopilot/route.ts

### Contenido (escenarios, agentes, técnicas) (P2)
- [ ] (IMP-1) escenario-telecom — [M] nuevo escenario con infraestructura (core, facturación, provisión) — src/lib/sim/roster.ts, src/lib/sim/seed.ts
- [ ] (IMP-1) escenario-gobierno-identidad — [M] identidad federada, registro civil y portal ciudadano — src/lib/sim/roster.ts
- [ ] (IMP-1) escenario-cloud-contenedores — [M] orquestador, registro de imágenes, secretos y CI/CD — src/lib/sim/roster.ts
- [ ] (IMP-1) escenario-educacion — [S] campus, LMS, investigación — src/lib/sim/roster.ts
- [ ] (IMP-1) escenario-logistica — [S] WMS, flota, EDI con proveedores — src/lib/sim/roster.ts
- [ ] (IMP-1) nuevas-firmas-lab — [L] ampliar el catálogo del lab (JWT manipulado, SSRF interno, XXE, IDOR, credential stuffing, abuso de API) con su detección en BLUE — src/lib/lab/runtime.ts, src/lib/lab/ops.ts
- [ ] (IMP-1) sexto-agente-por-equipo — [M] ampliar el roster con un agente especializado nuevo por equipo — src/lib/sim/roster.ts
- [ ] (IMP-1) taxonomia-v2 — [S] ampliar categorías/tags y reglas de normalización con tests — src/lib/sim/taxonomy.ts

### Laboratorio (P1-P2)
- [ ] (IMP-1) refactor-runtime-lab — [L] dividir `runtime.ts` (800 líneas) en manejadores por tipo de servicio sin cambiar comportamiento; tras `tests-lab-runtime` — src/lib/lab/
- [ ] (IMP-1) modelo-latencia — [S] latencia y fallos deterministas por nodo para telemetría más realista — src/lib/lab/runtime.ts
- [ ] (IMP-1) puerto-lab-resiliente — [S] si `LAB_PORT` está ocupado, mensaje claro y estado visible en `/api` en lugar de fallo silencioso — src/lib/lab/runtime.ts, src/app/api/route.ts
- [ ] (IMP-1) reinicio-limpio-lab — [S] estado del lab aislado por campaña y limpieza garantizada al terminar o cancelar — src/lib/lab/store.ts

### LLM (P1-P2)
- [ ] (IMP-1) llm-por-equipo — [M] proveedor/modelo distinto para RED y BLUE — src/lib/sim/llm.ts, src/lib/sim/provider-config.ts
- [ ] (IMP-1) contabilidad-llm — [M] contador de llamadas, tokens y coste estimado por campaña, guardado en BD — src/lib/sim/llm.ts, prisma/schema.prisma
- [ ] (IMP-1) reintentos-backoff — [S] reintentos con retroceso exponencial y circuit breaker antes de degradar a determinista — src/lib/sim/llm.ts
- [ ] (IMP-1) salida-validada — [M] validar con esquema la salida del LLM (lecciones, acciones) y reintentar o degradar ante formato inválido — src/lib/sim/llm.ts
- [ ] (IMP-1) versionado-prompts — [S] prompts versionados y registrados con la campaña para comparar resultados — src/lib/sim/llm.ts
- [ ] (IMP-1) cache-respuestas — [S] caché opcional en desarrollo para repetir campañas sin gastar créditos — src/lib/sim/llm.ts

### Conocimiento (P2)
- [ ] (IMP-1) envejecimiento-confianza — [M] decaimiento de confianza por antigüedad y falta de uso — src/lib/sim/knowledge-score.ts
- [ ] (IMP-1) deduplicar-lecciones — [M] detección de lecciones casi iguales (n-gramas) y fusión con trazabilidad — src/lib/sim/knowledge-score.ts, src/lib/sim/taxonomy.ts
- [ ] (IMP-1) deteccion-contradicciones — [L] marcar lecciones contradictorias y resolver por evidencia — src/lib/sim/knowledge-score.ts
- [ ] (IMP-1) experimento-reinyeccion — [M] medir si reinyectar conocimiento mejora resultados (campañas con y sin lecciones) y mostrar el efecto — src/lib/sim/engine.ts, scripts/

### API y datos (P1)
- [ ] (IMP-1) paginacion-cursor — [M] paginación por cursor y selección de campos en `/api/campaigns` y `/api/knowledge` — src/app/api/campaigns/route.ts, src/app/api/knowledge/route.ts
- [ ] (IMP-1) state-ligero — [M] `/api/state` con ETag/`If-None-Match` o diferencias para no reenviar todo en cada sondeo — src/app/api/state/route.ts
- [ ] (IMP-1) stream-sse — [L] eventos en vivo por SSE (`/api/campaigns/[id]/stream`) en lugar de sondeo — src/app/api/campaigns/[id]/, src/hooks/use-arena-state.tsx (coordinar con IMP-2)
- [ ] (IMP-1) replay-api — [M] endpoint que devuelve los eventos de una campaña ordenados para el replay — src/app/api/campaigns/[id]/
- [ ] (IMP-1) archivar-borrar-campana — [M] `DELETE`/archivado con las mismas protecciones de mutación (token, same-origin, rate limit) — src/app/api/campaigns/[id]/
- [ ] (IMP-1) errores-uniformes — [S] formato de error único `{error, code}` en todos los endpoints — src/app/api/
- [ ] (IMP-1) contrato-openapi — [M] documento OpenAPI generado o mantenido junto a `api-types.ts` — src/lib/api-types.ts, docs/
- [ ] (IMP-1) politica-retencion — [M] poda opcional de eventos antiguos con resumen conservado — src/lib/db.ts, scripts/
- [ ] (IMP-1) backup-restauracion — [S] scripts de copia y restauración de la BD SQLite — scripts/
- [ ] (IMP-1) exportar-importar-dataset — [M] exportar/importar campañas completas en JSON versionado — src/app/api/, scripts/
- [ ] (IMP-1) indices-y-consultas — [S] revisar índices y consultas lentas con 1 000+ campañas — prisma/schema.prisma, src/lib/db.ts
- [ ] (IMP-1) metricas-internas — [M] endpoint `/api/metrics` con contadores (campañas, eventos, errores LLM, latencias) — src/app/api/metrics/
- [ ] (IMP-1) logging-estructurado — [M] registros JSON con id de petición y campaña, sin secretos — src/lib/

### Informes e integraciones (P2-P3)
- [ ] (IMP-1) mapeo-mitre — [L] asociar cada acción a táctica/técnica ATT&CK y guardarlo en el evento — src/lib/lab/ops.ts, prisma/schema.prisma
- [ ] (IMP-1) export-attack-navigator — [M] exportar la cobertura como capa JSON compatible con ATT&CK Navigator (depende de `mapeo-mitre`) — src/lib/aggregate-report.ts, src/app/api/
- [ ] (IMP-1) informe-html-pdf — [L] informe ejecutivo en HTML imprimible y PDF por campaña y agregado — src/lib/aggregate-report.ts
- [ ] (IMP-1) reglas-deteccion-exportables — [L] BLUE genera reglas de detección (formato tipo Sigma) a partir de sus lecciones y se exportan — src/lib/sim/engine.ts, src/lib/aggregate-report.ts
- [ ] (IMP-1) torneos-y-benchmarks — [L] baterías reproducibles (misma semilla, varios agentes/modelos) con tabla de resultados — src/lib/sim/, scripts/
- [ ] (IMP-1) escenarios-como-datos — [L] escenarios en ficheros JSON validados por esquema (cargados desde `scenarios/`) en lugar de código — src/lib/sim/roster.ts, scenarios/

---

## SEG — Seguridad y bugs

### P0-P1
- [x] (SEG) endurecimiento-hd — [S] HD3: verificar que el bucket `admin:` y la barrera same-origin se aplican ANTES de la comparación del token en las 5 mutaciones (cierra el oracle de fuerza bruta de ADMIN_TOKEN; /api/auth ya comparte el bucket — confirmar el orden en el código) y HD4: alinear el orden real 403→429→401→413 con el documentado — src/lib/net/access.ts (reparto de la Ronda 12 sin ejecutar, rescatado por DIR) · hecho 2026-10-23: orden canónico en campaigns (same-origin → admin: 30/min → token → tope → cubo 6/min), settings y models parsean tras el 401, auth conserva 413 antes del 401 por inherencia; orden documentado en access.ts — 7eb5a1d · perpetuación: caso 3 de security-verify (31 intentos → 429 incluso con token válido, bucket admin: compartido); sugerible añadir la variante directa contra /api/campaigns
- [x] (SEG) test-superficie-mutaciones — [M] test que exige los tres controles (same-origin, rate limit, token) en cada una de las 5 mutaciones (campaigns, autopilot, settings, models, auth): cierre estructural del patrón «enumeración manual falla» que HD3 re-confirma — tests/ (reparto de la Ronda 12 sin ejecutar, rescatado por DIR) · hecho 2026-10-23: test descubre por directorio los handlers POST/PUT/PATCH y exige el contrato contra el handler real (403 primero, ráfaga 401→429 al 31º, 429 con token válido); una mutación futura sin controles rompe la suite — 35c0023, release 0b90343; suite 372 tests · ratificado por DIR
- [ ] (SEG) csp-estricta — [L] política CSP con nonces; verificar hidratación en navegador real antes de activar — next.config.ts · verificado 2026-10-23: sigue abierta, las cabeceras actuales son las no rompientes del stand-alone; requiere navegador real
- [x] (SEG) cuerpo-chunked — [M] acotar cuerpos `chunked` sin `Content-Length` (limitación documentada) leyendo el stream con tope — src/lib/net/access.ts · hecho 2026-10-23: `readJsonBody` consume el stream con tope y cancela al superarlo; 4 rutas migradas + 2 casos en security-verify
- [x] (SEG) autopiloto-gasto — [M] revisar el gasto LLM disparable por el modo continuo (riesgo R4) y su límite efectivo — src/lib/sim/autopilot.ts, src/app/api/autopilot/ · revisado 2026-10-23: CONFIRMADO que no hay tope efectivo (12 s de calma, sin ventanas ni tope diario); documentado en README (R4) y derivado a (IMP-1) autopiloto-presupuesto
- [x] (SEG) token-comparacion-constante — [S] comparar `ADMIN_TOKEN` con comparación de tiempo constante y test — src/lib/net/access.ts · verificado 2026-10-23: ya implementado (timingSafeEqual + dummyCompare para no filtrar longitud)
- [x] (SEG) cookie-admin-httponly — [M] endpoint de acceso que fije la cookie `admin_token` con `HttpOnly; SameSite=Strict` en vez de `document.cookie` — src/lib/net/access.ts, src/app/api/ · hecho 2026-10-23: POST/DELETE /api/auth (login/logout, Secure en https, 12 h, bucket admin:) + 5 casos en security-verify
- [ ] (SEG) dns-rebinding-guard — [M] el guard SSRF comprueba literales; resolver el host y validar la IP en el punto de uso para cerrar rebinding — src/lib/net/target-guard.ts · verificado 2026-10-23: mitigación parcial ya en código (resolución DNS con TODAS las direcciones en clasificación, bloqueo siempre de metadata vía DNS, `redirect: 'error'`); residual TOCTOU entre clasificar y fetch — cerrarlo exige conectar por IP con Host fijado, cambio invasivo que merece tarea propia
- [ ] (SEG) ssrf-ip-pinning — [L] cerrar el TOCTOU residual del guard SSRF conectando por la IP ya resuelta con cabecera Host fijada (el guard clasifica, pero `fetch` re-resuelve); cambio invasivo: partir en piezas con tests de regresión; derivada de la verificación de dns-rebinding-guard — src/lib/net/target-guard.ts, src/lib/net/
- [x] (SEG) rate-limit-memoria — [S] expulsión de claves antiguas del rate limit en memoria para que no crezca sin límite — src/lib/net/access.ts · verificado 2026-10-23: ya implementada (limpieza perezosa al superar 1000 claves)
- [x] (SEG) xss-evidencia-ui — [M] comprobar que comandos y evidencia del lab se renderizan siempre como texto (sin HTML) en UI, informes y copia al portapapeles — src/components/arena/ · verificado 2026-10-23: cero `dangerouslySetInnerHTML`/`innerHTML`/`document.cookie` en src/; React escapa por defecto y la evidencia viaja como texto/JSON
- [ ] (SEG) validacion-esquemas-api — [L] validar con esquema todas las entradas de POST/PUT y parámetros de consulta (límites, tipos, listas blancas) — src/app/api/
- [x] (SEG) errores-sin-fuga — [S] respuestas de error sin trazas ni rutas internas en producción — src/app/api/ · verificado 2026-10-23: las 8 rutas devuelven mensajes genéricos ("Error interno") y las trazas solo a console del servidor
- [x] (SEG) escaneo-secretos-historial — [S] `gitleaks`/`trufflehog` sobre el historial completo (cierra R7) y anotar resultado — scripts/, docs/agentes/estado/SEG.md · ejecutado 2026-10-23: 212 commits contra 7 familias de patrones + blobs históricos de `.env` (solo DATABASE_URL) y `db/custom.db` (sin claves): LIMPIO; resultado en estado/SEG.md

### P2
- [x] (SEG) cabeceras-extra — [S] COOP/CORP y `Cache-Control` adecuado en respuestas con datos; verificar con `security-verify` — next.config.ts, scripts/security-verify.mjs · hecho 2026-10-23: COOP/CORP same-origin en todas las respuestas y `Cache-Control: no-store` solo en `/api/*` (los assets conservan su caché immutable); checks en security-verify — 47d4f90, release 384e52d
- [x] (SEG) caddy-hardening — [S] HSTS, límites de cuerpo y tiempos en el Caddyfile del repo — Caddyfile · hecho 2026-10-23: timeouts (read_body/read_header 10 s, write 30 s, idle 2 m), `request_body max_size 1MB`, HSTS y `-Server` en el Caddyfile; `poweredByHeader: false` en next.config.ts con caso 12 duradero en security-verify; sintaxis según docs de Caddy v2 — `caddy validate` pendiente de ejecutar en el despliegue — 86497c2, 093b123, release d792d7d
- [ ] (SEG) auditoria-dependencias-ci — [M] auditoría de dependencias en cada PR y alerta de vulnerabilidades — .github/workflows/ (con PUL)
- [ ] (SEG) fuzz-normalizadores — [M] pruebas de fuzzing de `taxonomy`, `text` y parseo de filtros de URL — tests/
- [ ] (SEG) security-verify-casos-nuevos — [M] ampliar `security-verify` con casos de los hallazgos cerrados (cada fix = un caso) — scripts/security-verify.mjs
- [ ] (SEG) traversal-codificado-verify — [S] caso en `security-verify` de traversal codificado (`..%2f`), la variante que realmente llega al clasificador del lab (petición de IMP-1) — scripts/security-verify.mjs
- [ ] (SEG) sbom-y-lockfile — [S] generar SBOM y verificar integridad del `bun.lock` en CI — .github/workflows/
- [ ] (SEG) logs-sin-secretos — [S] comprobar que ningún log ni informe contiene claves, tokens ni cabeceras sensibles — src/lib/
- [x] (SEG) origin-allowlist-env — [S] validar el `Origin` también contra `NEXT_PUBLIC_SITE_URL` cuando esté definida, para despliegues tras proxies que reescriben el Host (complementa isSameOrigin) — src/lib/net/access.ts · hecho 2026-10-23: allowlist en isSameOrigin; sin la variable el comportamiento es exactamente el anterior y una URL malformada no relaja nada; 7 tests nuevos (334→341) — 407c7aa, release 5688039
- [ ] (SEG) allowlist-e2e-standalone — [S] caso e2e de la allowlist de origen arrancando el standalone con `NEXT_PUBLIC_SITE_URL` (hoy cubierta solo por unit tests; propuesta de SEG) — scripts/, tests/e2e/
- [ ] (SEG) gitleaks-ci — [S] fijar el escaneo de secretos en CI (`gitleaks protect` en cada push/PR); el barrido manual del 2026-10-23 quedó limpio y debe perpetuarse — .github/workflows/ (con PUL)
- [ ] (IMP-2) auth-ui — [M] formulario de login y estado de sesión cuando `ADMIN_TOKEN` está definido, usando `POST /api/auth` / `DELETE /api/auth` (cookie ya HttpOnly); sin guardar el token en localStorage — src/components/arena/, src/hooks/

---

## PUL — Pulimiento

### P1
- [ ] (PUL) tokens-hex-restantes — [S] última milla de la migración de tokens: auditar los literales `[#hex]` restantes y migrar los migrables a las escalas surface-*/ink-* (conteo bruto 439 en src/ el 2026-10-23; exclusiones anunciadas: SVG de analytics/network-map y semántica shadcn; el bloque pendiente del reparto de la Ronda 12 era la ficha /historial/[id] y sus apoyos), cero cambio visual; claim y coordinar con IMP-2 — src/app/, src/components/arena/
- [ ] (PUL) higiene-bd-llm — [S] auto-limpieza de las filas `llm.*` de prueba que inserta el script del canon, para que la BD compartida no acumule basura (gap reportado por pulimiento-14 en la Ronda 11) — scripts/ (reparto de la Ronda 12 sin ejecutar, rescatado por DIR)
- [ ] (PUL) engines-bun — [S] declarar la versión mínima de Bun (campo engines en package.json) y documentarla junto a los requisitos del README — package.json, README.md
- [x] (PUL) security-verify-puerto — [S] parametrizar el puerto fijo 3105 con variable de entorno (cambio acordado con SEG) — scripts/security-verify.mjs · hecho 2026-10-23 por SEG en su zona (el fichero es de SEG según OWNERSHIP; la asignación PUL queda sin efecto): `SECURITY_VERIFY_PORT` con defecto 3105, documentado en la salida del script · ratificado por DIR
- [ ] (PUL) readme-reestructurado — [M] README con tabla de contenidos, inicio rápido de 5 comandos, tabla de scripts y variables sincronizada con `.env.example` — README.md
- [ ] (PUL) dependencias-sobrantes — [M] [verificar] detectar dependencias no usadas y faltantes con una herramienta de análisis (`sharp` no se importa en `src/`, pero Next puede usarlo en el build standalone: comprobar antes de quitarlo) — package.json, bun.lock
- [ ] (PUL) lint-estricto — [M] endurecer ESLint (hooks, imports no usados, orden) y dejar 0 avisos en todo el repo — eslint.config.mjs, src/
- [ ] (PUL) hooks-git — [S] pre-commit (lint + tests rápidos) con lefthook o husky — package.json, .lefthook.yml
- [ ] (PUL) editorconfig-formato — [S] `.editorconfig` y formateador único con regla compartida — .editorconfig
- [ ] (PUL) dependabot-renovate — [S] actualizaciones automáticas agrupadas de dependencias — .github/
- [ ] (PUL) commitlint — [S] validar el formato de commits convencionales en CI — .github/workflows/

### P2
- [ ] (PUL) dividir-ficheros-grandes — [L] partir componentes de más de 450 líneas (`analytics.tsx`, `network-map.tsx`, `arena-live.tsx`, `history-panel.tsx`) sin cambiar comportamiento — src/components/arena/ (con claim; coordinar con IMP-2)
- [ ] (PUL) codigo-muerto — [M] detección de exportaciones sin uso y ficheros huérfanos con herramienta dedicada — src/
- [ ] (PUL) dockerfile-compose — [M] imagen y `docker compose up` con volumen para SQLite y variables documentadas — Dockerfile, docker-compose.yml
- [ ] (PUL) changelog-releases — [S] `CHANGELOG.md` desde commits y etiquetas de versión (0.3, 0.4, 1.0) — CHANGELOG.md
- [ ] (PUL) contributing-y-plantillas — [S] `CONTRIBUTING.md`, plantilla de issue y de PR (hallazgos de TEST enlazables) — CONTRIBUTING.md, .github/
- [ ] (PUL) capturas-regeneradas — [S] regenerar capturas y GIF tras cambios de UI con `generate-visuals.mjs`, respetando el límite de 5 MB — docs/screenshots/, README.md
- [ ] (PUL) doc-arquitectura — [M] `docs/ARQUITECTURA.md` con diagrama del flujo de campaña, solo si el Director lo aprueba — docs/
- [ ] (PUL) consistencia-nombres — [M] criterio único de nombres (ficheros, tipos, claves) y renombrado seguro con tests antes y después — src/
- [ ] (PUL) scripts-unificados — [S] consolidar `verify.sh` y `smoke.mjs`, y documentar cuándo usar cada script — scripts/, package.json

---

## TEST — Calidad por personas

Cada sesión rota al menos 4 personas. Suites e2e a construir en `tests/e2e/` (`*.e2e.mjs`):

- [x] (TEST) e2e-golden-path — [M] instalación desde cero según README, lanzar campaña, ver arena en vivo, ficha final y lecciones archivadas — tests/e2e/
- [x] (TEST) e2e-historial-filtros — [M] búsqueda con acentos, filtros y deep-links `?resultado=` / `?escenario=` desde analítica — tests/e2e/ (23/23: HistoryPanel real vía react-dom/server + servidor HTTP real; verificación interactiva pendiente de entorno con navegador en red compartida) · ratificado por DIR: 681f323, release 6a18534 (4ª desviación del convenio de tick directo, reconocida por TEST en su estado)
- [ ] (TEST) e2e-exportaciones — [M] CSV/JSON/`.md` íntegros: columnas, codificación, celdas peligrosas y consistencia con la ficha — tests/e2e/
- [ ] (TEST) e2e-model-studio-mock — [L] servidor local compatible OpenAI como fixture: descarga de catálogo, selección, errores 401/500/timeouts — tests/e2e/fixtures/
- [ ] (TEST) e2e-degradacion-llm — [M] proveedor caído a mitad de campaña: la campaña continúa en modo determinista y queda reflejado — tests/e2e/
- [x] (TEST) e2e-seguridad-http — [M] CSRF (`text/plain`, `Origin: null`), tokens, rate limits, cuerpos grandes y SSRF contra la instancia local — tests/e2e/ (35/35: fase A modo abierto + fase B ADMIN_TOKEN; incluye login erróneo/correcto, cookie y logout que pidió SEG; cierra H-001 con SEG) · ratificado por DIR: dd76326, release 1492458
- [x] (TEST) e2e-doble-lanzamiento — [S] doble clic y peticiones simultáneas de `POST /api/campaigns` — tests/e2e/
- [ ] (TEST) estados-vacios-e2e — [S] e2e del banner de desconexión, la tarjeta de reintento y los EmptyState (persona «usuario torpe» con el servidor parado; propuesta de IMP-2) — tests/e2e/
- [ ] (TEST) e2e-reinicio-servidor — [M] matar el servidor a mitad de campaña y comprobar la recuperación de huérfanas — tests/e2e/
- [ ] (TEST) e2e-autopiloto — [M] activar/desactivar, coerción del booleano, respeto de límites — tests/e2e/
- [ ] (TEST) e2e-entorno-adverso — [M] `LAB_PORT` inválido u ocupado, `DATABASE_URL` relativa, BD ausente o corrupta — tests/e2e/
- [ ] (TEST) e2e-volumen — [M] 500-1 000 campañas sembradas: tiempos de historial, búsqueda y exportación — tests/e2e/
- [ ] (TEST) e2e-actualizacion-bd — [M] abrir una BD de una versión anterior con el esquema nuevo — tests/e2e/
- [ ] (TEST) e2e-movil-visual — [M] capturas a 390 px de todas las páginas y comparación con la línea base — tests/e2e/ · nota TEST: limitación de red del navegador headless documentada en estado TEST sesión 3 — leer antes de planificar
- [ ] (TEST) e2e-accesibilidad — [M] pasada automatizada con herramienta de accesibilidad sobre las páginas principales y registro de hallazgos — tests/e2e/ · nota TEST: misma limitación headless — valorar herramienta que no dependa de red del navegador
- [ ] (TEST) e2e-soak-autopiloto — [M] ejecución prolongada con autopiloto: memoria, crecimiento de BD, errores acumulados — tests/e2e/
- [x] (TEST) tiempo-instalacion-readme — [S] medir el tiempo y los fallos de la instalación en frío y registrarlo en el estado — docs/agentes/estado/TEST.md

---

## DIR — Gobierno

- [x] (DIR) definicion-de-hecho — [S] criterio único por tipo de tarea (feature, fix, refactor, UI, seguridad) y comprobarlo en cada revisión — docs/agentes/ROADMAP.md · hecho 2026-10-23 (3ª pasada): bloque «Qué significa [x]» tras la leyenda; aplica desde esta revisión
- [ ] (DIR) metricas-semanales — [S] resumen en `estado/DIR.md`: duración del verify, nº de tests, hallazgos abiertos por destinatario, tareas cerradas — docs/agentes/estado/DIR.md · hecho 2026-10-23 (4ª pasada): sección «Métricas» estructurada en estado/DIR.md; se alimenta de las puertas declaradas por cada zona y, si se construye, del JSON del panel de gobernanza
- [ ] (DIR) hitos-versiones — [S] fijar qué entra en v0.3, v0.4 y v1.0 y recortar tareas que no caben — docs/agentes/ROADMAP.md
- [ ] (DIR) revisar-zonas — [S] cada ~3 sesiones comprobar que OWNERSHIP sigue encajando con `src/` (tras refactors y nuevas carpetas) — docs/agentes/OWNERSHIP.md
- [ ] (DIR) aprobar-docs-nuevos — [S] decidir si procede `ARQUITECTURA.md`, `CONTRIBUTING.md` y `CHANGELOG.md` (el protocolo prohíbe documentos nuevos sin su visto bueno) — docs/agentes/ROADMAP.md
- [ ] (DIR) cobertura-personas — [S] priorizar en cada sesión las personas que TEST no ha probado — docs/agentes/hallazgos/

---

## Ideas grandes (P3, no reclamar hasta que DIR las parta)

- **Editor de escenarios:** crear y validar escenarios desde la UI (nodos, vulnerabilidades, objetivos), guardados como datos (`escenarios-como-datos`).
- **Modo laboratorio de investigación:** experimentos reproducibles con semilla, repeticiones y exportación de resultados para comparar modelos, prompts y estrategias.
- **Entrenamiento de equipos por currículo:** secuencias de escenarios de dificultad creciente con el conocimiento acumulado entre ellas.
- **Biblioteca de reglas de detección:** catálogo navegable de las reglas generadas por BLUE, con su evidencia de origen.
- **Galería pública de campañas:** informes de solo lectura exportables (HTML estático) para compartir sin exponer la app.
- **Modo espectador:** enlace de solo lectura a una campaña en curso o finalizada (streaming de eventos sin mutaciones ni datos sensibles), predecesor ligero de la galería mientras la exportación estática no existe.
- **Sello de origen del conocimiento (antiveneno):** cada lección conserva trazabilidad a la campaña y a la evidencia que la generó; detección de lecciones «envenenadas» (derivadas de evidencia manipulada o ruido) con cuarentena revisable — complementa prompt-injection-evidencia, que sanea la entrada pero no audita lo ya aprendido.
- **Modo cooperativo humano+agente:** un operador inserta o veta acciones en RED o BLUE junto a los agentes, con la misma trazabilidad de eventos; convierte la arena en herramienta de entrenamiento real (evoluciona desde el modo espectador).
- **Panel de gobernanza en vivo:** página (o `GET /api/gobernanza`) que sirve el estado del sistema multiagente: ticks del ROADMAP, claims activos y su edad, hallazgos abiertos por destinatario y resultado de la última puerta — para el propietario, sin abrir el repo; el mismo JSON alimenta las métricas semanales de DIR.
- **Modo multiusuario:** cuentas, roles y espacios separados (cierra el riesgo R4 de forma estructural; exige rediseñar el modelo de acceso).
- **Extensiones:** puntos de enganche para nuevos agentes, firmas y escenarios sin tocar el núcleo.

---

## Riesgos y decisiones vigentes (máx. 30 líneas; DIR actualiza)

- **R4 — Acceso:** sin autenticación por defecto (`ADMIN_TOKEN` opt-in) y autopiloto con gasto LLM. No exponer la app a Internet sin proxy con autenticación. Revisión SEG 2026-10-23: el autopiloto NO tiene hoy tope de gasto (ver `autopiloto-presupuesto`); login con cookie HttpOnly disponible (`POST /api/auth`). Cierre total: modo multiusuario.
- **R7 — Historia git:** `.env` y BD antiguos en el historial. ESCANEADO 2026-10-23 (212 commits, 7 familias de patrones + blobs): LIMPIO — el `.env` histórico solo tenía `DATABASE_URL` y la BD histórica no guarda claves. Pendiente perpetuar el escaneo en CI (`gitleaks-ci`).
- **R10 — `DATABASE_URL`:** variable global del contenedor frente a `.env`; usar siempre ruta absoluta.
- **R13 — TOCTOU de DNS rebinding en el guard SSRF (riesgo aceptado documentado):** el guard resuelve y valida, pero `fetch` re-resuelve después; la mitigación completa exige fijar la IP resuelta en el punto de uso. No afecta al modelo de despliegue vigente (no expuesto); ver tarea `dns-rebinding-guard`.
- **R11 / D27 — Artefactos de verificación obsoletos:** build limpio (`rm -rf .next/cache`) en cambios masivos de UI y `security-verify` sobre standalone recién construido (ya recogido en PROTOCOLO §3).
- **Nuevo — Migraciones:** `db:push --accept-data-loss` puede perder datos; cualquier cambio de esquema con datos reales pasa por migración (`db-push-accept-data-loss`).
- **Nuevo — Licencia:** falta `LICENSE` (`license-decision`, decide el dueño).
- **Decisión D6 (vigente):** filtros de URL con `useSearchParams` en componente propio dentro de `<Suspense>` y validación contra lista blanca.
- **Decisión D18 (vigente):** el progreso vive en la escala cerrada [0,100]; `repair-progress-scale.mjs` repara históricos fuera de rango.
