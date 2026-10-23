H-004-validacion-entradas-lanzamiento
---
Tipo: mejora
Severidad: BAJO
Persona: usuario torpe/despistado
Dirigido a: IMP-1
Estado: abierto
---

**Pasos para reproducir** (instancia local, motor ocioso):

```
curl -s -X POST -H 'content-type: application/json' \
  -d '{"scenarioId":"escenario-inexistente"}' http://127.0.0.1:3115/api/campaigns
curl -s -X POST -H 'content-type: application/json' \
  -d '{json-malformado' http://127.0.0.1:3115/api/campaigns
```

**Resultado esperado**: 400 con un error claro («el escenario no existe» / «cuerpo JSON inválido»); ninguna campaña lanzada.

**Resultado real**: ambas peticiones devuelven `{"ok":true,"campaignId":"…"}` y lanzan una campaña con escenario aleatorio. El usuario despistado que manda un id mal copiado descubre que su campaña corre contra OTRO escenario solo cuando abre la ficha; el fallback está comentado en el código («sin body → escenario aleatorio») pero también atrapa entradas inválidas.

**Sugerencia**: validar `scenarioId` contra la lista real (400 si no existe) y rechazar JSON malformado con 400; el lanzamiento aleatorio puede quedar como comportamiento explícito (`scenarioId: "random"` o cuerpo vacío válido).
