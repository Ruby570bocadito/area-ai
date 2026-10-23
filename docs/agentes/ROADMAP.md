# ROADMAP — area-ai

Único escritor: DIR. Los demás roles proponen vía "Propuestas" en su `estado/<ID>.md`.
Archivo pensado para `docs/agentes/ROADMAP.md`. Formato de tarea: `- [ ] (ID destino) slug — [talla] descripción — rutas`.

**Leyenda**
- Talla: `[S]` ≤ 1 tarea corta · `[M]` una tarea completa con tests · `[L]` partir en piezas funcionales por sí solas (cada pieza = su propio slug).
- Prioridad por sección: **P0** bloquea a todos o es riesgo real · **P1** siguiente fase · **P2** valor alto, sin urgencia · **P3** ideas grandes / exploratorias.
- `[verificar]` = hipótesis sacada de leer el repo, sin comprobar. El dueño la confirma (con test o prueba reproducible) antes de implementar; si no se confirma, borra la tarea y lo anota en su estado.
- Estado de partida (v0.2.1): 6 escenarios, 10 agentes (5 RED / 5 BLUE), laboratorio HTTP real en 127.0.0.1, 215 tests unitarios, smoke de 17 comprobaciones, sin CI, sin `loading.tsx` / `error.tsx` / `not-found.tsx`, sin tema claro ni i18n, sin tests unitarios dedicados para `engine.ts`, `lab/runtime.ts`, `lab/ops.ts`, `progression.ts`, `knowledge-score.ts`, `provider-config.ts`.
- Regla que nunca se rompe: todo ataque/defensa ocurre contra el laboratorio local (127.0.0.1). Ninguna idea de este documento autoriza apuntar a hosts externos.

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
- [ ] (PUL) retirar-informes-z — [S] borrar `docs/agentes/z_*` (68 archivos) tras la migración del Director — docs/agentes/
- [ ] (PUL) congelar-worklog — [S] `worklog.md`: comprobar referencias, borrar o dejar como histórico sin más entradas; quitar firmas de asistente y el nombre antiguo "AEGIS ARENA" — worklog.md
- [ ] (PUL) readme-agentes-v2 — [S] sustituir la tabla "Agentes del proyecto" por los 6 roles y rutas nuevas — README.md
- [ ] (PUL) ci-basico — [M] workflow con `bun install`, lint, `bun run test` y typecheck en push/PR; caché de bun — .github/workflows/
- [ ] (PUL) script-typecheck — [S] añadir `typecheck` (`tsc --noEmit`) a `package.json` para CI y agentes — package.json
- [ ] (PUL) paquete-nombre — [S] renombrar `nextjs_tailwind_shadcn_ts` a `area-ai` y buscar restos de nombres antiguos con grep — package.json, src/
- [ ] (PUL) license-decision — [S] el repo se presenta como open source pero no hay `LICENSE` en la raíz: pedir al dueño qué licencia y añadirla — LICENSE, README.md
- [ ] (SEG) db-push-accept-data-loss — [S] `db:push` usa `--accept-data-loss`: documentar el riesgo y proponer migraciones (`prisma migrate`) para cualquier cambio de esquema con datos — package.json, prisma/ (cambio de script vía PUL)
- [ ] (SEG) csv-formula-injection — [M] [verificar] las exportaciones CSV incluyen comandos y evidencia controlados por el lab: neutralizar celdas que empiecen por `=`, `+`, `-`, `@` y test de regresión — src/lib/event-export.ts, src/lib/knowledge-export.ts, src/lib/aggregate-report.ts
- [ ] (SEG) prompt-injection-evidencia — [M] [verificar] la evidencia del lab (respuestas HTTP) llega a los prompts del LLM que genera lecciones: acotar longitud, escapar delimitadores y validar la salida con esquema — src/lib/sim/llm.ts, src/lib/sim/engine.ts
- [x] (IMP-1) tests-engine — [L] red de seguridad antes de refactorizar: tests del motor con RNG sembrado (elección de agentes por fase, momentum RED, respuesta BLUE, progreso siempre en [0,100]) — src/lib/sim/engine.ts, tests/
- [ ] (IMP-1) tests-lab-runtime — [L] tests del runtime del lab (política de red por niveles, sesiones, firewall, parcheo, clasificación de firmas) con servidor efímero en puerto libre — src/lib/lab/runtime.ts, src/lib/lab/ops.ts, tests/
- [ ] (IMP-1) tests-progresion-conocimiento — [M] tests de `progression.ts`, `knowledge-score.ts` y `provider-config.ts` — src/lib/sim/, tests/
- [x] (IMP-2) estados-error-carga — [M] añadir `loading.tsx`, `error.tsx` y `not-found.tsx` (global y por ruta principal) con estilo coherente — src/app/
- [ ] (IMP-2) skeletons-polling — [M] esqueletos mientras `/api/state` carga por primera vez y estado "sin conexión / reintentando" cuando el sondeo falla — src/hooks/use-arena-state.tsx, src/components/arena/
- [ ] (TEST) baseline-e2e — [M] primera pasada completa por las 4 personas mínimas y primeros hallazgos; fijar la línea base de tiempos del README en frío — tests/e2e/, docs/agentes/hallazgos/

---

## IMP-2 — Frontend / UX

### Global y shell (P1)
- [ ] (IMP-2) tema-claro-oscuro — [L] tema claro además del oscuro con tokens en `globals.css` y `arena-colors.ts`, conmutador persistido, respetar `prefers-color-scheme` — src/app/globals.css, src/lib/arena-colors.ts, src/components/arena/shell/
- [ ] (IMP-2) accesibilidad-base — [L] auditoría y arreglos: `aria-label` en controles icónicos, foco visible, orden de tabulación, contraste AA, landmarks, `aria-live="polite"` en el feed de eventos — src/components/arena/
- [ ] (IMP-2) reduced-motion — [M] respetar `prefers-reduced-motion` en framer-motion, partículas, haces del mapa y NumberFlow — src/components/arena/, src/app/globals.css
- [ ] (IMP-2) i18n-es-en — [L] extraer textos de UI a diccionarios y ofrecer inglés (los textos están en español en los componentes); `lang` dinámico — src/components/, src/app/layout.tsx
- [ ] (IMP-2) barra-estado-sistema — [M] indicador permanente de salud (BD, lab, proveedor LLM, modo determinista activo) usando el healthcheck `GET /api` — src/components/arena/shell/app-shell.tsx
- [ ] (IMP-2) paleta-comandos-v2 — [M] ampliar `⌘K`: ir a campaña por id, lanzar escenario concreto, activar autopiloto, cambiar tema/idioma, buscar lecciones y agentes — src/components/arena/command-palette.tsx
- [ ] (IMP-2) atajos-teclado — [S] overlay de ayuda (`?`) con todos los atajos y navegación por teclado entre secciones — src/components/arena/shell/
- [ ] (IMP-2) onboarding-primera-visita — [M] recorrido de 4-5 pasos (qué es RED/BLUE, fases, cómo se decide la victoria) descartable y recordado por navegador — src/components/arena/
- [ ] (IMP-2) pagina-ayuda-glosario — [M] `/ayuda` con fases MITRE, tipos de nodo, firmas detectadas, regla de victoria (explicando `victory.ts`) y FAQ — src/app/ayuda/
- [ ] (IMP-2) pagina-ajustes — [M] `/ajustes`: rondas por defecto, intervalo y presupuesto del autopiloto, tema, idioma, retención de datos — src/app/ajustes/
- [ ] (IMP-2) toasts-coherentes — [S] unificar copys, duración y acciones de los avisos (campaña terminada, error de red, exportación lista) — src/components/ui/, src/components/arena/
- [ ] (IMP-2) estados-vacios — [S] estados vacíos con guía de siguiente paso en historial, conocimiento, analítica y agente sin actividad — src/components/arena/
- [ ] (IMP-2) rendimiento-bundle — [M] analizar el bundle, `dynamic()` para gráficos y mapa, evitar renders del sondeo global en páginas que no lo usan — src/app/, src/hooks/
- [ ] (IMP-2) pwa-og-iconos — [S] manifest, iconos por tamaño y imagen Open Graph estática coherente con la marca — public/, src/app/
- [ ] (IMP-2) auditoria-movil — [M] pasada de usabilidad a 360/390/768 px en todas las páginas (tablas con scroll, menús, mapa táctil) — src/components/arena/, src/app/
- [ ] (IMP-2) catalogo-componentes-dev — [M] página solo en desarrollo con todos los componentes y estados (carga, vacío, error) para revisión visual — src/app/dev/ui/

### Panel de mando — `src/app/page.tsx`, `control-center.tsx`
- [ ] (IMP-2) tarjetas-escenario-ricas — [M] cada escenario muestra dificultad, duración estimada, objetivos y un mini-mapa de su red antes de lanzar — src/components/arena/control-center.tsx
- [ ] (IMP-2) configurar-campana — [L] configuración avanzada previa al lanzamiento: preset de rondas (rápida 6 / estándar 12), selección de agentes por equipo, semilla, motor LLM o determinista — src/components/arena/control-center.tsx (requiere API de IMP-1)
- [ ] (IMP-2) confirmacion-lanzamiento — [S] confirmación ligera y protección contra doble clic al lanzar campaña — src/components/arena/control-center.tsx
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
- [ ] (IMP-1) seed-determinista — [M] semilla por campaña guardada en BD para reproducir una campaña idéntica en modo determinista — src/lib/sim/engine.ts, prisma/schema.prisma
- [ ] (IMP-1) refactor-engine-fases — [L] partir `engine.ts` (936 líneas) en módulos (selección, rondas, combate, cierre) sin cambiar comportamiento; solo tras `tests-engine` — src/lib/sim/
- [ ] (IMP-1) dificultad-adaptativa — [M] ajustar fuerza de la defensa según el historial de victorias del escenario, con tope y desactivable — src/lib/sim/pace.ts, src/lib/sim/engine.ts
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
- [ ] (SEG) csp-estricta — [L] política CSP con nonces; verificar hidratación en navegador real antes de activar — next.config.ts
- [ ] (SEG) cuerpo-chunked — [M] acotar cuerpos `chunked` sin `Content-Length` (limitación documentada) leyendo el stream con tope — src/lib/net/access.ts
- [ ] (SEG) autopiloto-gasto — [M] revisar el gasto LLM disparable por el modo continuo (riesgo R4) y su límite efectivo — src/lib/sim/autopilot.ts, src/app/api/autopilot/
- [ ] (SEG) token-comparacion-constante — [S] [verificar] comparar `ADMIN_TOKEN` con comparación de tiempo constante y test — src/lib/net/access.ts
- [ ] (SEG) cookie-admin-httponly — [M] endpoint de acceso que fije la cookie `admin_token` con `HttpOnly; SameSite=Strict` en vez de `document.cookie` — src/lib/net/access.ts, src/app/api/
- [ ] (SEG) dns-rebinding-guard — [M] [verificar] el guard SSRF comprueba literales; resolver el host y validar la IP en el punto de uso para cerrar rebinding — src/lib/net/target-guard.ts
- [ ] (SEG) rate-limit-memoria — [S] [verificar] expulsión de claves antiguas del rate limit en memoria para que no crezca sin límite — src/lib/net/access.ts
- [ ] (SEG) xss-evidencia-ui — [M] [verificar] comprobar que comandos y evidencia del lab se renderizan siempre como texto (sin HTML) en UI, informes y copia al portapapeles — src/components/arena/
- [ ] (SEG) validacion-esquemas-api — [L] validar con esquema todas las entradas de POST/PUT y parámetros de consulta (límites, tipos, listas blancas) — src/app/api/
- [ ] (SEG) errores-sin-fuga — [S] respuestas de error sin trazas ni rutas internas en producción — src/app/api/
- [ ] (SEG) escaneo-secretos-historial — [S] `gitleaks`/`trufflehog` sobre el historial completo (cierra R7) y anotar resultado — scripts/, docs/agentes/estado/SEG.md

### P2
- [ ] (SEG) cabeceras-extra — [S] COOP/CORP y `Cache-Control` adecuado en respuestas con datos; verificar con `security-verify` — next.config.ts, scripts/security-verify.mjs
- [ ] (SEG) caddy-hardening — [S] HSTS, límites de cuerpo y tiempos en el Caddyfile del repo — Caddyfile
- [ ] (SEG) auditoria-dependencias-ci — [M] auditoría de dependencias en cada PR y alerta de vulnerabilidades — .github/workflows/ (con PUL)
- [ ] (SEG) fuzz-normalizadores — [M] pruebas de fuzzing de `taxonomy`, `text` y parseo de filtros de URL — tests/
- [ ] (SEG) security-verify-casos-nuevos — [M] ampliar `security-verify` con casos de los hallazgos cerrados (cada fix = un caso) — scripts/security-verify.mjs
- [ ] (SEG) sbom-y-lockfile — [S] generar SBOM y verificar integridad del `bun.lock` en CI — .github/workflows/
- [ ] (SEG) logs-sin-secretos — [S] comprobar que ningún log ni informe contiene claves, tokens ni cabeceras sensibles — src/lib/

---

## PUL — Pulimiento

### P1
- [ ] (PUL) security-verify-puerto — [S] parametrizar el puerto fijo 3105 con variable de entorno (cambio acordado con SEG) — scripts/security-verify.mjs
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

- [ ] (TEST) e2e-golden-path — [M] instalación desde cero según README, lanzar campaña, ver arena en vivo, ficha final y lecciones archivadas — tests/e2e/
- [ ] (TEST) e2e-historial-filtros — [M] búsqueda con acentos, filtros y deep-links `?resultado=` / `?escenario=` desde analítica — tests/e2e/
- [ ] (TEST) e2e-exportaciones — [M] CSV/JSON/`.md` íntegros: columnas, codificación, celdas peligrosas y consistencia con la ficha — tests/e2e/
- [ ] (TEST) e2e-model-studio-mock — [L] servidor local compatible OpenAI como fixture: descarga de catálogo, selección, errores 401/500/timeouts — tests/e2e/fixtures/
- [ ] (TEST) e2e-degradacion-llm — [M] proveedor caído a mitad de campaña: la campaña continúa en modo determinista y queda reflejado — tests/e2e/
- [ ] (TEST) e2e-seguridad-http — [M] CSRF (`text/plain`, `Origin: null`), tokens, rate limits, cuerpos grandes y SSRF contra la instancia local — tests/e2e/
- [ ] (TEST) e2e-doble-lanzamiento — [S] doble clic y peticiones simultáneas de `POST /api/campaigns` — tests/e2e/
- [ ] (TEST) e2e-reinicio-servidor — [M] matar el servidor a mitad de campaña y comprobar la recuperación de huérfanas — tests/e2e/
- [ ] (TEST) e2e-autopiloto — [M] activar/desactivar, coerción del booleano, respeto de límites — tests/e2e/
- [ ] (TEST) e2e-entorno-adverso — [M] `LAB_PORT` inválido u ocupado, `DATABASE_URL` relativa, BD ausente o corrupta — tests/e2e/
- [ ] (TEST) e2e-volumen — [M] 500-1 000 campañas sembradas: tiempos de historial, búsqueda y exportación — tests/e2e/
- [ ] (TEST) e2e-actualizacion-bd — [M] abrir una BD de una versión anterior con el esquema nuevo — tests/e2e/
- [ ] (TEST) e2e-movil-visual — [M] capturas a 390 px de todas las páginas y comparación con la línea base — tests/e2e/
- [ ] (TEST) e2e-accesibilidad — [M] pasada automatizada con herramienta de accesibilidad sobre las páginas principales y registro de hallazgos — tests/e2e/
- [ ] (TEST) e2e-soak-autopiloto — [M] ejecución prolongada con autopiloto: memoria, crecimiento de BD, errores acumulados — tests/e2e/
- [ ] (TEST) tiempo-instalacion-readme — [S] medir el tiempo y los fallos de la instalación en frío y registrarlo en el estado — docs/agentes/estado/TEST.md

---

## DIR — Gobierno

- [ ] (DIR) definicion-de-hecho — [S] criterio único por tipo de tarea (feature, fix, refactor, UI, seguridad) y comprobarlo en cada revisión — docs/agentes/ROADMAP.md
- [ ] (DIR) metricas-semanales — [S] resumen en `estado/DIR.md`: duración del verify, nº de tests, hallazgos abiertos por destinatario, tareas cerradas — docs/agentes/estado/DIR.md
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
- **Modo multiusuario:** cuentas, roles y espacios separados (cierra el riesgo R4 de forma estructural; exige rediseñar el modelo de acceso).
- **Extensiones:** puntos de enganche para nuevos agentes, firmas y escenarios sin tocar el núcleo.

---

## Riesgos y decisiones vigentes (máx. 30 líneas; DIR actualiza)

- **R4 — Acceso:** sin autenticación por defecto (`ADMIN_TOKEN` opt-in) y autopiloto con gasto LLM. No exponer la app a Internet sin proxy con autenticación. Cierre total: modo multiusuario.
- **R7 — Historia git:** `.env` y BD antiguos en el historial, sin secretos reales conocidos. Cerrar con `escaneo-secretos-historial`.
- **R10 — `DATABASE_URL`:** variable global del contenedor frente a `.env`; usar siempre ruta absoluta.
- **R13 — TOCTOU de DNS rebinding en el guard SSRF (riesgo aceptado documentado):** el guard resuelve y valida, pero `fetch` re-resuelve después; la mitigación completa exige fijar la IP resuelta en el punto de uso. No afecta al modelo de despliegue vigente (no expuesto); ver tarea `dns-rebinding-guard`.
- **R11 / D27 — Artefactos de verificación obsoletos:** build limpio (`rm -rf .next/cache`) en cambios masivos de UI y `security-verify` sobre standalone recién construido (ya recogido en PROTOCOLO §3).
- **Nuevo — Migraciones:** `db:push --accept-data-loss` puede perder datos; cualquier cambio de esquema con datos reales pasa por migración (`db-push-accept-data-loss`).
- **Nuevo — Licencia:** falta `LICENSE` (`license-decision`, decide el dueño).
- **Decisión D6 (vigente):** filtros de URL con `useSearchParams` en componente propio dentro de `<Suspense>` y validación contra lista blanca.
- **Decisión D18 (vigente):** el progreso vive en la escala cerrada [0,100]; `repair-progress-scale.mjs` repara históricos fuera de rango.
