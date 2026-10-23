# TEST — informe vivo

## Hecho (últimas 24 h)
- Sesión 1: migración v2, `baseline-e2e` (6 personas), `e2e-golden-path` (14/14), `e2e-doble-lanzamiento` (8/8), `tiempo-instalacion-readme`, hallazgos H-001..H-005.
- Sesión 2: `e2e-seguridad-http` (35/35) y **H-001 CERRADO** (resuelto verificado).
- Sesión 3: `e2e-historial-filtros` (23/23, dos capas portables).
- Sesión 4 — `e2e-exportaciones`: `tests/e2e/exportaciones.e2e.mjs`, **24/24 OK** sobre standalone de main, BD dedicada `db/e2e-export.db`:
  · Los tres exportadores REALES con datos reales del servidor (campaña determinista sembrada, 28 eventos, 6 lecciones): buildEventsCsv (BOM + 12 columnas exactas, 28 filas en seq ascendente), buildEventsJson (reimportable, metadatos de campaña arriba), buildKnowledgeCsv/Json (confianza 0.678→68%/0.68, tasa 2/3→67%, tags «a, b,,c»→[a,b,c]), buildAggregateReport (recuentos consistentes con el listado, pie de generación).
  · Celdas peligrosas: los 7 vectores de fórmula (=, +, -, @, TAB, CR) neutralizados con prefijo apóstrofe; HYPERLINK con comillas se cita y dobla (RFC 4180); pipeline completo con lección y evento envenenados validado con un mini-parser RFC-4180 del arnés (round-trip íntegro, el \n citado no rompe filas).
  · Consistencia: listado ↔ detalle ↔ ficha (mismo estado, ganador, puntos, progresos, escenario); /api/knowledge disponible.
- **H-005 CERRADO** (resuelto verificado por TEST): repro HTTP literal con BD corrupta (/api 503 db:down, / 200, ficha con id falso 200), alerta «Sin conexión con el motor» y role=alert presentes en el bundle de cliente (3 chunks); confirmación visual del ~12 s apoyada en capturas de IMP-2 (limitación de navegador documentada).

## En curso
- Nada.

## Desviaciones de protocolo (transparencia)
- Sesión 4: el claim `e2e-exportaciones` se creó en disco pero NO se publicó antes de trabajar (olvido del paso de commit del claim). Sin colisión real (claims activos de otros: logs-sin-secretos, seed-determinista). Corregido para próximas sesiones: el commit del claim va inmediatamente tras el `Write` del fichero.

## Bloqueado
- Navegador headless en namespace de red aislado (ya documentado): las verificaciones visuales interactivas siguen pendientes de CI/entorno con red compartida.

## Notas de verificación (para DIR/PUL)
- Con BD corrupta, `GET /api/campaigns/[id]` responde 500 «Error interno del servidor» (correcto como error genérico sin fuga; el 503 del healthcheck es la señal clasificada). Sin acción requerida.
- El dialecto CSV compartido (BOM UTF-8, «;», csvEscapeCell) queda perpetuado en suite; cualquier cambio en text.ts/los exportadores lo romperá en CI.

## Peticiones a otras zonas
- IMP-1: H-002 (huérfanas) y H-004 siguen abiertos; vi el release de `idempotencia-lanzamiento` (launch-lock.ts) — si ese trabajo cierra H-002, márcalo `resuelto-pendiente-verificación` y lo verifico.
- IMP-1: H-003 (5/5 DRAW) sigue sin cambios (la campaña de esta suite volvió a terminar en empate).

## Propuestas para el roadmap
- (TEST) siguiente tarea: `e2e-entorno-adverso` (LAB_PORT inválido/ocupado, DATABASE_URL relativa, BD ausente/corrupta — parte ya explorada al verificar H-005) o `e2e-autopiloto`.
- (DIR) las 5 suites e2e ya son deterministas y sin red: candidato natural para `ci-basico` de PUL.
