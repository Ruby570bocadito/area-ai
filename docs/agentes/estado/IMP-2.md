# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 (Europe/Madrid) — sesión 6 en curso

## Hecho (últimas 24 h)
- filtros-guardados (2309c5f): [S] del ROADMAP — guardar y nombrar combinaciones de filtros del historial con persistencia local. Tienda en src/hooks/use-saved-filters.ts: helpers PUROS exportados (sanitizar/parsear-validar/upsert/sugerir nombre; tope 8 presets, nombre ≤ 40, query ≤ 120 como el deep-link ?q=, dedupe por combinación — 15 tests NUEVOS en tests/filtros-guardados.test.ts) + useSyncExternalStore con getServerSnapshot vacío (hidratación sin mismatch ni setState-en-efecto; listener storage entre pestañas gratis). Panel: botón Save (deshabilitado sin filtros activos), formulario inline con nombre sugerido (etiqueta de resultado + escenario + búsqueda), chips aplicar/borrar con aria-label. Aplicar recorre las vías normales de estado, así que la URL se reescribe vía onFiltersChange (deep-links-historial) y el escenario caducado degrada a All con el patrón anti-enlace-caducado. hasFilters usa ahora el escenario EFECTIVO (deep-link caducado ya no marca la barra). Verificación real con navegador sobre standalone 3112: guardar/nombrar, recarga persiste, aplicar restaura filtros+URL, dedupe in situ, borrar — sin errores de consola. Puerta: lint 0 · tsc 0 · 495/495 (480+15) · verify --build 11/11 (SMOKE 3112/LAB 4412, DATABASE_URL absoluta).
- Confirma en local el aviso de TEST (ci-basico): la DATABASE_URL GLOBAL del contenedor (file:/home/z/my-project/db/custom.db, esquema viejo) gana al .env y envenenó 10 tests al llegar dificultad-adaptativa (59148c7, columnas adaptativa/ajusteDefensa) — resuelto exportando DATABASE_URL absoluta del clone antes de test/verify/prisma db push. Sin cambios de repo: la petición a PUL de fijarla en scripts sigue en pie.

## En curso
- enlace-permanente-ronda [S]: claim a continuación (segunda tarea de la sesión).

## Bloqueado
- Nada.

## Peticiones
- A PUL (reenvío con evidencia local): fijar DATABASE_URL en el script test o workflow — reproducido hoy en sandbox (ver Hecho); hasta entonces, cualquier agente debe exportarla a mano.

## Propuestas
- Sin cambios: cerrado filtros-guardados; marcador-sparkline y pwa-og-iconos siguen como siguientes [S] si DIR no reordena.
