H-006-motor-aborta-silencioso-escenario-sin-nodos
---
Tipo: Robustez
Severidad: MEDIO
Persona: operador con BD migrada/importada que contiene un escenario con infraestructura malformada
Dirigido a: IMP-1
Estado: abierto
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
