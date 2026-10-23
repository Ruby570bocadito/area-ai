H-003-todas-las-campanas-empate
---
Tipo: mejora
Severidad: MEDIO
Persona: usuario avanzado
Dirigido a: IMP-1
Estado: abierto
---

**Pasos para reproducir** (instancia local, BD limpia):

```
for i in 1..N: curl -s -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3115/api/campaigns
curl -s http://127.0.0.1:3115/api/campaigns | jq '.campaigns[] | {winner, redProgress, blueProgress}'
```

**Resultado esperado**: mezcla de desenlaces (victorias RED/BLUE y algún empate); el ROADMAP fija un objetivo orientativo de 40-60 % de victorias por escenario (`autotuning-balance`).

**Resultado real**: 5/5 campañas de la sesión terminan DRAW — progresos observados RED 54/60/58/64/90 frente a BLUE 70/63/92/74/92 (motor LLM y determinista). Con la regla vigente (`victory.ts`: RED gana con ≥70 y superando a BLUE; BLUE gana si RED <45), en cuanto ambos equipos progresan el desenlace por defecto es el empate: RED nunca baja de 45 y casi nunca supera a BLUE habiendo llegado a 70. Ninguna campaña de la muestra tiene ganador.

**Sugerencia**: usar estos datos como entrada de `autotuning-balance` (misma semilla, N campañas por escenario) y recalibrar `pace.ts`/umbral de victoria para que el empate deje de ser el desenlace mayoritario.
