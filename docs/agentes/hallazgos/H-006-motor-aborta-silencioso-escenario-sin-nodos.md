H-006-motor-aborta-silencioso-escenario-sin-nodos
---
Tipo: Robustez
Severidad: MEDIO
Persona: operador con BD migrada/importada que contiene un escenario con infraestructura malformada
Dirigido a: IMP-1
Estado: resuelto-pendiente-verificación (IMP-1, bbd1b28)
---

**Pasos para reproducir** (descubierto durante el desarrollo de `e2e-actualizacion-bd`, iteración de arnés con escenario sembrado con `infrastructure='{"nodes":[]}'`):

```
# 1. BD dedicada con schema actual; arrancar el standalone y lanzar una
#    campaña cualquiera → ensureSeed puebla roster + Setting de seedDone
# 2. Parar el servidor y dejar el escenario malformado como ÚNICO visible:
bun -e 'const {Database}=require("bun:sqlite");const db=new Database("db/repro.db");
db.prepare("DELETE FROM Scenario WHERE key != '"'"'hist-malo'"'"'").run()'   # hist-malo: infrastructure={"nodes":[]}
# 3. Arrancar de nuevo y lanzar determinista:
curl -s -X POST -H 'content-type: application/json' \
  -d '{"determinista":true,"seed":2026}' http://127.0.0.1:PORT/api/campaigns
# → {"ok":true,"campaignId":"…"} (HTTP 200: el lanzamiento PARECE correcto)
# → ~2 s después: campaña ABORTED; en el log del servidor:
# [engine] error fatal de campaña: TypeError: undefined is not an object (evaluating 'y.id')
```

**Resultado esperado**: el motor tolera (o rechaza con error de lanzamiento clasificado) un escenario cuya infraestructura no tiene nodos — la degradación debe ser visible y clasificada, no una campaña que se aborta en silencio.

**Resultado real**: `startCampaign` valida semillas y running-guard, pero NO valida la infraestructura del escenario elegido; `runCampaign` revienta en el arranque del bucle (`nodes[…].id` sobre undefined), el catch genérico marca ABORTED y la causa solo queda en el log del servidor. El POST devolvió 200 con eco de seed/determinista: desde la perspectiva del operador la campaña «salió» y luego murió sin explicación visible. El escenario malformado puede llegar por una BD de otra versión/instancia (exactamente el camino de actualización que documenta `e2e-actualizacion-bd`) o por edición manual.

**Sugerencia**: en `startCampaign` (o en la elección de escenario), excluir/validar escenarios con `infrastructure` sin nodos — si no queda ninguno válido, error de lanzamiento clasificado (400/503 con causa legible) en vez de ABORTED silencioso; alternativamente, `runCampaign` puede envolver el parseo de `infrastructure` con degradación controlada y registro estructurado. Nota: `e2e-actualizacion-bd` sembró infraestructura VÁLIDA para no depender de este bug (el foco de esa suite es la actualización de BD); este hallazgo queda para el motor.

**Resolución (IMP-1, 2026-10-23 — bbd1b28):** cierre en tres capas, ambas
vías de la sugerencia aplicadas (validación en el arranque + degradación
controlada en el bucle).

1. `parsearInfraestructura` (puro, engine-select.ts): null ante JSON
   malformado, `nodes` ausente/vacío o nodos sin el contrato EXACTO que
   bootLab desreferencia sin guardia (id, type, segment, criticality,
   vulnerabilities, controls — `vulnerabilities.map` y `controls.some`
   reventarían a mitad de campaña igual que `nodes[…].id`).
2. `elegirEscenarioLanzable` en startCampaign, ANTES del create: el azar
   explícito solo recae sobre escenarios sostenibles; un id pedido que
   existe pero no es lanzable → `ESCENARIO_INVALIDO` → 400 con el id y la
   causa (resolverEscenario gana parámetro catálogo — decir «inexistente»
   era un diagnóstico falso); id inexistente → SCENARIO_NOT_FOUND intacto
   (H-004); si NINGUNO es lanzable → `SIN_ESCENARIOS_VALIDOS` → 503
   (problema de datos del servidor, no de la petición). Rechazos sin side
   effects (sin fila, sin bucle, sin lab).
3. `runCampaign` (capa defensiva): si la BD cambia ENTRE el create y el
   bucle (edición manual/import concurrente), el fallo se registra
   clasificado («Infraestructura inválida en el escenario <key>») en vez
   de un TypeError anónimo — la fila queda ABORTED con causa legible.

**Tests** (tests/infraestructura-lanzable.test.ts, 15): el repro EXACTO del
hallazgo (`{"nodes":[]}` → null → POST 400 sin campaña), malformaciones por
campo, grafo con UN nodo roto rechazado entero, azar siempre sobre válidos
(12×3), ESCENARIO_INVALIDO vs SCENARIO_NOT_FOUND vs SIN_ESCENARIOS_VALIDOS,
compatibilidad de la firma previa de resolverEscenario y ruta contra BD real
sin side effects. **dificultad-adaptativa actualizada honestamente**: sus 4
lanzamientos reales usaban `{"nodes":[]}` explotando justamente este crash
(«abortaba rápido»); ahora llevan nodo válido, corren el ciclo SIM completo
y su limpieza retira también las lecciones enlazadas.

Puerta: lint 0 · 514/514 · verify --build 11/11 (re-ejecutada tras el rebase).
