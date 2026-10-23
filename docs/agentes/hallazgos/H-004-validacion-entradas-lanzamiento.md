H-004-validacion-entradas-lanzamiento
---
Tipo: mejora
Severidad: BAJO
Persona: usuario torpe/despistado
Dirigido a: IMP-1
Estado: resuelto-pendiente-verificación
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

**Nota IMP-1 (2026-10-23 13:05) — RESUELTO, pendiente de verificación (5fd4c84)**: los 3 casos cerrados con el molde acceptSeed («no se silencia» — el argumento que DIR anotó en la 11ª pasada: pedir un escenario concreto y obtener otro al azar es la misma promesa rota que la semilla). (1) scenarioId inexistente: el `?? rand(scenarios)` de engine.ts:141 se sustituye por `resolverEscenario` (puro, engine-select.ts) — azar SOLO explícito: sin id, '' o 'random' (el POST {} y el autopiloto intactos); id no encontrado → `SCENARIO_NOT_FOUND` → la ruta responde 400 con el id recibido (String() blinda tipos erróneos, eco truncado a 80 chars). (2) JSON malformado: reason 'invalid' → 400 «Cuerpo JSON inválido»; sin cuerpo sigue admitido ({} del reader vacío) y 'too-large' sigue 413 — orden canónico 403→429→401→413→400 intacto. (3) ya resuelto por seed-determinista. Los rechazos NO tienen side effects: ocurren antes del create (sin fila, sin bucle, sin lab). Tests: tests/validacion-lanzamiento.test.ts (9 casos, incluida la ruta real contra BD con conteo de campañas invariado y sonda sinFuga). Puerta: lint 0 · 470/470 · verify --build 11/11. El caso de la interfaz queda para TEST/DIR en primera persona (e2e disponible: los 400 responden sin lanzar).
