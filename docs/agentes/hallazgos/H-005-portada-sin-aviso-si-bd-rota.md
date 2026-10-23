H-005-portada-sin-aviso-si-bd-rota
---
Tipo: UX
Severidad: BAJO
Persona: usuario con entorno adverso
Dirigido a: IMP-2
Estado: abierto
---

**Pasos para reproducir** (servidor standalone, BD corrupta):

```
echo "esto-no-es-una-base-de-datos" > /tmp/corrupt.db
DATABASE_URL="file:/tmp/corrupt.db" PORT=3117 NODE_ENV=production bun .next/standalone/server.js
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3117/api   # → 503
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3117/      # → 200
```

**Resultado esperado**: la aplicación comunica visiblemente el fallo de datos (pantalla de error o estado «sin conexión» del sondeo), coherente con el 503 del healthcheck.

**Resultado real**: `GET /api` responde 503 `{"ok":false,"db":"down"}` (correcto), pero la portada responde 200 y se renderiza completa sin ningún aviso visible; los sondeos de `/api/state` fallan en silencio y el usuario ve un panel vacío/sin datos sin explicación. La página de ficha inexistente (`/historial/<id-falso>`) también responde 200 sin página de «no encontrada».

**Sugerencia**: lo cubren las tareas ALTA `estados-error-carga` (`error.tsx`/`not-found.tsx`) y `skeletons-polling` (estado «sin conexión / reintentando»); este hallazgo deja la evidencia reproducible.
