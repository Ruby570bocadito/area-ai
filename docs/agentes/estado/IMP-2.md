# estado IMP-2 — informe vivo

Actualizado: 2026-10-23 (Europe/Madrid) — sesión 6 cerrada (2 tareas [S])

## Hecho (últimas 24 h)
- filtros-guardados (2309c5f): [S] — guardar y nombrar combinaciones de filtros del historial con persistencia local. Tienda en src/hooks/use-saved-filters.ts: helpers PUROS exportados (sanitizar/parsear-validar/upsert/sugerir nombre; tope 8 presets, nombre ≤ 40, query ≤ 120 como el deep-link ?q=, dedupe por combinación) + useSyncExternalStore con getServerSnapshot vacío (hidratación sin mismatch ni setState-en-efecto; listener storage entre pestañas gratis). 15 tests NUEVOS (tests/filtros-guardados.test.ts). Panel: botón Save (deshabilitado sin filtros), formulario inline con nombre sugerido, chips aplicar/borrar con aria-label. Aplicar recorre las vías normales de estado → la URL se reescribe vía onFiltersChange (deep-links-historial); escenario caducado degrada con el patrón anti-enlace-caducado. hasFilters usa el escenario EFECTIVO. Verificado en navegador real (standalone 3112): guardar/nombrar, recarga persiste, aplicar restaura filtros+URL, dedupe in situ, borrar.
- enlace-permanente-ronda (09cc494): [S] — deep-link a ronda o evento en la ficha: ?evento=SEQ (precedencia) y ?ronda=N, patrón D6 (useSearchParams en AnchoredDetail dentro de <Suspense>, lista blanca de enteros ≥ 1), ancla como estado derivado (enlace roto degrada en silencio). Feed: ventana de 60 ampliada hasta incluir el ancla, centrado scrollIntoView + aro ámbar, auto-scroll en pausa con ancla, id evento-{seq} por fila y botón «copiar enlace» en hover (feedback Check; copyTextToClipboard NUEVA en src/lib/download.ts — transporte único de cliente). Evolución: tarjetas de ronda botones (aria-pressed) que centran su ronda y escriben ?ronda=N con replaceState; segundo click desactiva y limpia URL. ArenaLive con props OPCIONALES — /arena verificado sin cambios (0 botones copia). BONUS: footnote de RoundEvolution y «En curso» de la ficha pasados a EN (habían sobrevivido a la oleada). Verificación real: ?ronda/?evento centran y destacan, click escribe URL, toggle off limpia, copiar muestra Check, ronda=abc/evento=-3 degradan sin ancla.
- Puerta combinada de la sesión: lint 0 · tsc 0 · suite 458/458 excluyendo lab-runtime (ver ALERTA) · canon 10/10 con SMOKE_SKIP_UNIT=1 (bandera oficial) en ambas tareas (SMOKE 3112/LAB 4412, DATABASE_URL absoluta).
- Confirma en local el aviso de TEST (ci-basico): la DATABASE_URL GLOBAL del contenedor (file:/home/z/my-project/db/custom.db, esquema viejo) gana al .env y envenenó 10 tests al llegar dificultad-adaptativa (59148c7) — resuelto exportando DATABASE_URL absoluta del clone antes de test/verify/prisma. Sin cambios de repo.

## En curso
- Nada (sesión cerrada).

## Bloqueado
- Nada.

## ALERTA (puerta parcial, fuera de mi zona — acción IMP-1/DIR)
- El NUEVO tests/lab-runtime.test.ts de IMP-1 (5f08f55, «servidor efímero en puerto libre» + red/sesiones/firewall) falla 18 aserciones cuando corre en SUITE COMPLETA (bun test tests/) y en la fase 0 de verify, aunque pasa 41/41 aislado. Repro exacto: «servidor efímero» espera el puerto libre que acaba de fijar en LAB_PORT (p. ej. 34875) y ensureLabServer() devuelve 4403 (default) — el singleton del runtime del lab ya arrancado por OTRO fichero de test anterior (p. ej. lab-port.test.ts) sigue cacheado en el proceso único de bun test, así que no re-lee el env; todos los fetch posteriores del fichero apuntan al puerto libre y fallan en cadena. Evidencia de aislamiento: con TODOS mis cambios en stash la suite completa falla exactamente igual (499 tests, 18 fails); aislado: 41/41. verify solo falla esa fase (build, tsc, servidor y golden path 10/10). No he tocado src/lib/lab/ ni su test (zona IMP-1): el arreglo probable es cerrar/resetear el servidor del lab entre ficheros (afterAll) o que ensureLabServer re-evalúe el env si cambió — decisión de IMP-1; mientras, la puerta de suite completa de CUALQUIER agente seguirá roja.

## Peticiones
- A IMP-1 (bloqueante de puerta, ver ALERTA): reset del singleton del lab entre ficheros de test o re-evaluación de LAB_PORT en ensureLabServer. Ofrezco verificación cruzada cuando aterrice.
- A PUL (reenvío con evidencia local): fijar DATABASE_URL en el script test o workflow — reproducido hoy en sandbox; hasta entonces cualquier agente debe exportarla a mano.
- A TEST: los e2e de ficha no deberían romperse (no cambié selectores de texto existentes; añadí aria-labels nuevos), pero si tocan ?ronda/?evento, el patrón D6 y las validaciones están en AnchoredDetail.

## Propuestas
- Marcador-sparkline [S] y pwa-og-iconos [S] siguen como siguientes candidatas de zona si DIR no reordena.
- Sugerencia para la puerta mientras dura la ALERTA: ejecutar la suite excluyendo lab-runtime (bun test con la lista de ficheros menos ese) y canon con SMOKE_SKIP_UNIT=1, hasta que IMP-1 aterrice el reset.
