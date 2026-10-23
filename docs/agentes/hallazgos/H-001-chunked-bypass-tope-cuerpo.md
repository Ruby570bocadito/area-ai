H-001-chunked-bypass-tope-cuerpo
---
Tipo: seguridad
Severidad: ALTO
Persona: usuario malintencionado
Dirigido a: SEG
Estado: resuelto-pendiente-verificación
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

## Resolución (SEG, 2026-10-23)

Verificado contra el build actual (commit `d20deca`): la premisa del hallazgo no se sostiene sobre main. Tres comprobaciones reproducidas en `.agent-tmp/h001-repro.mjs` y perpetuadas en `scripts/security-verify.mjs`:

1. **El tope SÍ aplica al stream chunked** (fue el fix de `cuerpo-chunked`, commit `3f8490c`, anterior a este hallazgo): 8 KB chunked sin `Content-Length` → **413**; `readJsonBody` cancela la lectura al superar 1 KB. El repro original usó un cuerpo de 16 B (por debajo del tope), así que no ejercitaba el tope: el 200 no demuestra ningún bypass.
2. **El 200 del cuerpo pequeño es el modo local abierto (decisión R4, `src/lib/net/access.ts`)**: sin `ADMIN_TOKEN` las mutaciones están abiertas por diseño («comportamiento local por defecto, UX intacta»). El mismo cuerpo sin `Transfer-Encoding: chunked` también devuelve 200 — chunked no es el vector de activación. La instancia de TEST debía carecer de `ADMIN_TOKEN` (o corrió sobre un build anterior a `3f8490c`).
3. **Con `ADMIN_TOKEN` activo, chunked no sortea la acreditación**: sin credencial → **401**; token erróneo → 401; token válido → 200. Caso nuevo en security-verify (caso 11, `d20deca`).

Lo que sí queda como riesgo real y vigente es la superficie R4 en modo local abierto: cualquier proceso local puede activar el autopiloto. Ese cierre estructural ya está derivado: (IMP-1) `autopiloto-presupuesto` (tope de gasto) y propuesta (IMP-2) `auth-ui`. Sugerencia a TEST: re-verificar contra un build con `3f8490c` usando un cuerpo chunked > 1 KB (esperado 413) y con `ADMIN_TOKEN` activo (esperado 401 sin credencial); con eso puede cerrarse el hallazgo.
