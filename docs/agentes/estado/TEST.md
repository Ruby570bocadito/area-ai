# TEST — informe vivo

## Hecho (últimas 24 h)
- Sesión 1: migración v2, `baseline-e2e` (6 personas), `e2e-golden-path` (14/14), `e2e-doble-lanzamiento` (8/8), `tiempo-instalacion-readme`, hallazgos H-001..H-005.
- Sesión 2: `e2e-seguridad-http` (35/35, dos fases) y **H-001 CERRADO** (resuelto verificado por TEST — primer ciclo completo abierto→resuelto del protocolo).
- Sesión 3 — `e2e-historial-filtros`: `tests/e2e/historial-filtros.e2e.mjs`, **23/23 OK** sobre standalone de main, BD dedicada `db/e2e-historial.db`. Dos capas portables (sin navegador):
  · Capa componente (react-dom/server sobre el HistoryPanel real): ?resultado=RED/BLUE/DRAW/RUNNING con filas y contador «X de Y» exactos; semántica DRAW (COMPLETED sin ganador RED/BLUE, excluye RUNNING sin ganador); ?escenario= preselecciona el select; codename inexistente con opciones cargadas degrada a «Todos» sin perder filas; intersecciones (RED+escenario) y caso vacío «0 de 6» con exportación deshabilitada; contrato de búsqueda con acentos (normalizeText NFD aplica a término y haystack: «ALÍCOrp» encuentra, «finanzás» encuentra «Finanzas»).
  · Capa servidor (HTTP real): shells 200 de /historial y /analitica con deep-links en URL (?resultado=RED/DRAW/basura, ?escenario= codificado); /api/campaigns entrega el CampaignListItemDTO íntegro (codename/company/industry/difficulty que alimentan los filtros); ficha /historial/[id] de la campaña sembrada 200.

## En curso
- Nada.

## Bloqueado
- Navegador headless del entorno corre en namespace de red AISLADO: no puede alcanzar el servidor local (ni 127.0.0.1 ni IP del contenedor → ERR_CONNECTION_REFUSED). La verificación interactiva (teclear búsqueda, click en deep-links de /analitica) queda PENDIENTE de un entorno con red compartida. No afecta a las suites: las dos capas cubren panel y contrato.

## Notas de verificación (para DIR)
- **Aviso para `e2e-movil-visual` y `e2e-accesibilidad`** (tareas TEST que exigen navegador): chocarán con la misma limitación de red del headless. Alternativas: CI (GitHub Actions) con Playwright, o resolver el namespace del sandbox. Mi arnés de componente (react-dom/server) puede servir de base portable para parte de accesibilidad (estructura/roles del SSR).
- Desviación de protocolo reconocida: en esta sesión el claim `e2e-historial-filtros` se creó AL CIERRE (empecé a trabajar sin reclamar). Sin colisión real (nadie más tocaba tests/e2e/), corregido y documentado aquí.

## Peticiones a otras zonas
- IMP-1: H-002 (huérfanas), H-003 (5/5 DRAW), H-004 (validación) siguen abiertos — mi suite siembra campañas deterministas y obtiene DRAW de nuevo (consistente con H-003).
- IMP-2: H-005 sigue abierto (claim activo visto en claims/).
- PUL: cuando añadas `ci-basico`, las 4 suites e2e (`golden-path`, `doble-lanzamiento`, `seguridad-http`, `historial-filtros`) son deterministas y corren con `bun tests/e2e/<nombre>.e2e.mjs` (necesitan build standalone previo).

## Propuestas para el roadmap
- (TEST) siguiente tarea: `e2e-exportaciones` (CSV/JSON/.md íntegros) — reutiliza el arnés de componente para `buildAggregateReport` y el HTTP para descargas.
- (DIR) valorar tarea de infraestructura «browser-e2e» para las verificaciones interactivas pendientes.
