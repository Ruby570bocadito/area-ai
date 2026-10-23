H-005-portada-sin-aviso-si-bd-rota
---
Tipo: UX
Severidad: BAJO
Persona: usuario con entorno adverso
Dirigido a: IMP-2
Estado: resuelto (verificado por TEST)
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

**Resolución (IMP-2, 2026-10-23, commit 953cf88)**: verificado en standalone con los pasos de arriba (`/api` 503, `/` 200). Tras 2 sondeos fallidos (≈12 s) la portada muestra la tarjeta `role=alert` «Sin conexión con el motor» con reintento manual, y la ficha con id falso acaba igual (coherente con el 503). Complemento en `app-shell.tsx`: chip de conexión en rojo «Sin conexión» (topbar + sidebar, con prioridad sobre En directo/En espera) y «—» en proveedor/campañas/lecciones mientras no hay estado cargado — antes mostraba «En espera» verde y «0 campañas / 0 lecciones» inventadas. Evidencia: `.agent-tmp/h005-prod-offline.png` y `h005-fix-offline.png` (locales, no en el repo). Puerta: lint 0 · 335/335 · canon 11/11.

## Cierre (TEST, 2026-10-23)

Verificado contra el build standalone de main con los pasos literales del hallazgo (BD corrupta, `echo "esto-no-es-una-base-de-datos" > corrupt.db`):

1. **Healthcheck coherente**: `GET /api` → **503** `{"ok":false,"service":"area-ai","db":"down"}`; `GET /` → 200 (el shell SSR deja gobernar al sondeo de cliente).
2. **Ficha con id falso**: `GET /historial/id-falso` → 200 y el sondeo de `/api/state` falla → acaba en el mismo estado de desconexión (coherente con lo declarado por IMP-2; el detalle de API responde 500 «Error interno del servidor» con la BD rota).
3. **La alerta viaja en el bundle de cliente**: «Sin conexión con el motor» presente en 3 chunks de `.next/standalone/.next/static/chunks/` y `role="alert"` en el chunk del componente — el aviso se envía al navegador y se activa con 2 sondeos fallidos (~12 s), con chip «Sin conexión» en topbar/sidebar.

Alcance de la verificación: HTTP + bundle de cliente (el navegador headless de este entorno no puede alcanzar el servidor local — limitación documentada en estado/TEST.md); la confirmación visual del temporizado (~12 s) se apoya en las capturas de IMP-2 (`.agent-tmp/h005-fix-offline.png`) y en el código enviado al cliente. Cerrado como **resuelto**.
