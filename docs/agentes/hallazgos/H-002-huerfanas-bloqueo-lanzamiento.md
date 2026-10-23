H-002-huerfanas-bloqueo-lanzamiento
---
Tipo: mejora
Severidad: MEDIO
Persona: administrador/operador
Dirigido a: IMP-1
Estado: resuelto-pendiente-verificación (IMP-1, f4dd715)
---

**Pasos para reproducir** (instancia local, BD propia):

```
# 1. Lanzar campaña y matar el servidor a mitad (la fila queda RUNNING en BD)
curl -s -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3115/api/campaigns
kill -9 <pid del standalone>; reiniciar el servidor con la misma DATABASE_URL
# 2. Intentar lanzar de inmediato
curl -s -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3115/api/campaigns
```

**Resultado esperado**: tras reiniciar, el lanzamiento funciona (o al menos la respuesta explica la campaña interrumpida y cómo se resolverá).

**Resultado real**: `{"ok":false,"error":"Ya hay una campaña en curso"}` (409). La recuperación existe (`recoverOrphanCampaigns`, umbral 120 s sobre el último evento) pero SOLO se dispara cuando alguien consulta `GET /api/state`. Ciclo verificado empíricamente: POST inmediato → 409; tras 130 s, `GET /api/state` → la huérfana pasa a ABORTED (0 RUNNING de 6); el siguiente POST → 200 con campaña nueva. Un cliente que solo llama a `POST /api/campaigns` (sin navegador abriendo `/api/state`) recibe 409 indefinidamente; durante los primeros 120 s también lo recibe un usuario de la UI aunque consulte `/api/state`.

**Sugerencia**: llamar a `recoverOrphanCampaigns()` en el arranque del servidor y/o dentro de `POST /api/campaigns` antes del chequeo RUNNING; el 409 podría incluir el id y la antigüedad de la campaña en curso.

**Resolución (IMP-1, 2026-10-23 — f4dd715):** cierre en dos piezas, ambas
según la sugerencia del hallazgo.

1. `POST /api/campaigns` llama `recoverOrphanCampaigns()` ANTES del chequeo
   RUNNING (tras el dedupe, que solo re-juega 200: un replay no tapa la
   recuperación). Idempotente y conservador: el umbral de 120 s es el mismo
   que ya gobierna /api/state — las campañas VIVAS no se tocan.
2. El 409 ahora INFORMA: `campaignId` + `enCursoDesde` (ISO del arranque de
   la fila) viajan en el error desde startCampaign hasta la respuesta — el
   operador sabe QUÉ bloquea y DESDE CUÁNDO.

**Tests** (tests/huerfanas-recuperacion.test.ts, 4 — lanzamiento REAL en SIM
con aislamiento del SDK, molde dificultad-adaptativa): idempotencia de la
recuperación (2ª pasada no cambia nada); huérfana vieja (>120 s sin eventos)
que NO bloquea el POST — queda ABORTED con endedAt y el lanzamiento corre su
ciclo; campaña viva que SÍ bloquea con 409 informado (campaignId = fila viva,
enCursoDesde = startedAt exacto) y sin side effects (sin fila nueva, viva
intacta). Los cuerpos de cada POST llevan semilla distinta para no colisionar
con la ventana de dedupe de cuerpo (5 s).

Puerta: lint 0 · 484/484 · verify --build 11/11. Repro del hallazgo cubierto
por el 3er test: fila RUNNING vieja + POST → 200 (antes: 409 indefinido).
