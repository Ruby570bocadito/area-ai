H-001-chunked-bypass-tope-cuerpo
---
Tipo: seguridad
Severidad: ALTO
Persona: usuario malintencionado
Dirigido a: SEG
Estado: abierto
---

**Pasos para reproducir** (instancia local, sin `ADMIN_TOKEN`):

```
curl -s -X POST -H 'content-type: application/json' \
  -H 'Transfer-Encoding: chunked' \
  --data-binary '{"enabled":true}' \
  http://127.0.0.1:3115/api/autopilot        # → 200 {"ok":true,"enabled":true}
curl -s http://127.0.0.1:3115/api/autopilot  # → {"ok":true,"enabled":true}
```

**Resultado esperado**: el tope de cuerpo de `/api/autopilot` (1024 B) se aplique también a peticiones `chunked` sin `Content-Length`, o el endpoint rechace el cuerpo (411/413); el autopiloto no se activa.

**Resultado real**: HTTP 200 y el autopiloto queda ACTIVADO (verificado con `GET /api/autopilot` después). El cuerpo `chunked` sortea el tope pre-parse (limitación documentada en README §Seguridad y en el ROADMAP `cuerpo-chunked`) y, además, la mutación se ejecuta íntegra: un cliente sin navegador puede activar el modo continuo (gasto LLM en bucle, riesgo R4) sin límite de tamaño de cuerpo. Reproducido dos veces (sesiones del 2026-10-23).

**Sugerencia**: implementar la tarea `cuerpo-chunked` (leer el stream con tope y responder 413 al superarlo); mientras tanto, rechazar mutaciones con `Transfer-Encoding: chunked` (411).
