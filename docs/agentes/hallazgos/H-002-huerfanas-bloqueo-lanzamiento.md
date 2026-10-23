H-002-huerfanas-bloqueo-lanzamiento
---
Tipo: mejora
Severidad: MEDIO
Persona: administrador/operador
Dirigido a: IMP-1
Estado: abierto
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
