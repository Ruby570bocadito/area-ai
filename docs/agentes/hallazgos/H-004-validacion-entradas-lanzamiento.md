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

**Nota DIR (11ª pasada, 2026-10-23) — verificación en primera persona del estado actual**: el hallazgo sigue VIGENTE en 2 de sus 3 casos. (1) `scenarioId` inexistente: `engine.ts:141` ejecuta `scenarios.find((s) => s.id === scenarioId) ?? rand(scenarios)` — degrada a aleatorio EN SILENCIO, sin 400. (2) JSON malformado: `campaigns/route.ts` («sin cuerpo o JSON inválido → escenario aleatorio (comportamiento previo)») — también degrada. (3) RESUELTO por `seed-determinista`: seed y determinista inválidos devuelven 400 con el criterio «no se silencia — pedir una semilla concreta y obtener otra al azar es una promesa rota». Ese MISMO argumento aplica textualmente al caso 1: pedir un escenario concreto y obtener otro al azar es la misma promesa rota. Priorización de personas en estado/DIR.md de esta pasada: este es el pendiente #1 de la persona «usuario torpe».
