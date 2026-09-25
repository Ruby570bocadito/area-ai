# PROTOCOLO multiagente — canon de proceso del proyecto area·ai

> **Autoridad:** este documento es la referencia única de proceso para todos los agentes (`z_director`, `z_implementaciones`, `z_pulimiento`, `z_bugs` y cualquier rol futuro). Fue consolidado por el Director en la Ronda 4 (2026-09-25 17h25) a partir de las lecciones de las rondas 1-3 y sus 4 colisiones multiagente. **Última revisión: Ronda 6 (2026-09-25 18h05)** — re-chequeo pre-commit (§2.4), propietario único de tareas de documentación (§8), suite de tests versionados como norma (§3.6) y registro de riesgos R12-R15 (§9). En caso de discrepancia entre un informe antiguo y este documento, **prevalece este documento**. Cualquier cambio de norma lo decide y registra el Director mediante commit a este fichero.

---

## 1. Roles y alcance

| Rol | Función | NO hace |
|-----|---------|---------|
| `z_director` | Audita, reparte tareas, ratifica normas, adjudica colisiones, mantiene el registro de riesgos | No escribe features ni código de producto |
| `z_implementaciones` | Features y producto, tests de comportamiento, backlog de mejoras | No toca higiene de repo ni seguridad de base |
| `z_pulimiento` | README vivo, dependencias, limpieza de artefactos, deuda técnica de configuración | No toca la UI ni añade features |
| `z_bugs` | Seguridad (auth, SSRF, rate limit, secretos), corrección de bugs, auditoría de APIs | No añade features |

Ante duda de pertenencia: la tarea la ejecuta el rol cuyo ámbito la cubre; si cubre a dos, la reparte el Director en su informe de ronda.

## 2. Antes de actuar (protocolo anti-colisión) — OBLIGATORIO

Las 4 colisiones de la Ronda 3 demostraron que este protocolo no es opcional:

1. **`git fetch origin`** y comparar `HEAD` local con `origin/main` **justo antes de elegir tarea**. Si hay commits nuevos, leerlos antes de decidir.
2. **Leer el último informe del Director** en `docs/agentes/z_director/` — contiene el reparto de tareas vigente. Toma **tu tarea asignada**; si decides otra cosa, anótalo en tu informe con justificación.
3. **Anunciar el alcance ANTES de ejecutar** (en el informe, sección "Alcance anunciado").
4. **Re-chequear `origin/main` segundos antes del PRIMER commit** de la ronda (nueva norma, Ronda 6): las colisiones 6 y 7 de la Ronda 5 demostraron que dos sesiones pueden elegir la misma tarea en paralelo aunque ambas hayan leído el reparto. Si `origin` ya contiene tu tarea ejecutada por otra sesión, **deriva a la siguiente tarea del reparto** y registra la adjudicación en tu informe (§7) — la duplicación se adjudica, pero cuesta rebase y confusión de informes.
5. **Verificar `origin/main` justo antes de pushear.** Si apareció trabajo paralelo: rebase; si toca los mismos ficheros, aplicar la regla de adjudicación (§7).

## 3. Cierre de ronda (puerta de calidad) — OBLIGATORIO en toda ronda que toque código

Ratificado por el Director en la Ronda 4 (era pendiente de ratificación desde las rondas 3 de Pulimiento e Implementaciones):

1. **`bun tests/smoke.mjs --build`** en verde (8/8). Es el **canon único de verificación**: `bun run verify` y `bun run smoke` delegan en él. El flag `--build` es obligatorio si se cambió código de producto; en rondas solo-documentación basta sin rebuild.
2. **`bun run lint`** con 0 errores y 0 avisos en los ficheros tocados.
3. **README vivo:** si la ronda cambia comportamiento visible, variables de entorno o scripts, actualizar `README.md` y `.env.example` en la misma ronda.
4. **Informe de ronda** en `docs/agentes/z_<rol>/ronda_YYYY-MM-DD_HHhMM.md` (hora Europe/Madrid). **Nunca sobrescribir** informes previos; los cambios posteriores se añaden como addendum al final del mismo fichero. Si dos sesiones generan el mismo nombre de fichero (colisión AA), la que llega tarde renombra el suyo con sufijo `-duplicada` y añade addendum explicando la adjudicación.
5. **Entrada en `worklog.md`** del repo (append, formato existente).
6. **Tests unitarios versionados:** `bun test tests/` es la suite canónica (guard SSRF, acceso y resiliencia LLM). Todo módulo de seguridad nuevo llega con su test el mismo día; las funciones puras nuevas de `src/lib/` deberían seguirlo.

## 4. Commits — OBLIGATORIO

- Convencionales: `tipo(ámbito): descripción` — tipos en uso: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
- **Un commit por ámbito** (no mezclar feature + limpieza + docs en uno).
- Prohibido el formato UUID.
- El push se hace a `main` al cierre de la ronda, tras pasar la puerta de calidad (§3).

## 5. Convención de evidencia (capturas y GIFs) — RATIFICADA en Ronda 4

- Toda evidencia visual vive en **`docs/screenshots/`** con **nombre semántico en español** (p. ej. `panel-de-mando.png`, `campana-en-vivo.gif`).
- Se **enlazan desde el README** (tabla de capturas o cuerpo); nunca quedan sueltas en la raíz ni en `download/`.
- GIFs: objetivo **< 5 MB** (paleta optimizada, ≤ 8 fps, ancho ≤ 760 px).
- Los informes pueden referenciar la ruta de la evidencia; no duplicar ficheros.

## 6. Seguridad por defecto

- **Línea divisoria vigente:** lecturas `GET` abiertas (datos de simulación, sin secretos); mutaciones `POST` protegibles con `ADMIN_TOKEN` opt-in (header `X-Admin-Token` o cookie) + rate limit en campañas.
- Cualquier fetch a URL provista por usuario pasa por el guard `src/lib/net/target-guard.ts` (SSRF). No se añaden fetches salientes sin pasar por él.
- Secretos nunca en el repo; API key de proveedor siempre enmascarada en respuestas.
- Toda variable de entorno nueva se documenta en `.env.example` y en la tabla de variables del README.

## 7. Colisiones — regla de adjudicación

1. Si el trabajo paralelo **ya está en la historia canónica** de `origin/main` y **verificado** (golden path en verde), **prevalece** lo pusheado; el duplicado local se descarta.
2. Si ambas variantes coexisten (p. ej. dos smoke tests), el **Director consolida en un canon** y registra la decisión en addendum.
3. El árbitro objetivo siempre es la **puerta de calidad (§3)** sobre el árbol fusionado: si no pasa, la última mejora verificada gana y la otra se rehace sobre ella.
4. Toda colisión se documenta: addendum en el informe del agente afectado + nota del Director si implica revocar una decisión previa.

## 8. Reparto explícito de tareas

El **Director es el repartidor**: en cada informe de ronda publica la asignación de tareas por agente para la ronda siguiente (§ del informe). Las sesiones operativas ejecutan su tarea asignada como primer candidato, aplicando el §2 (incluido el re-chequeo de §2.4). Esto sustituye a la auto-organización que provocó las colisiones de la Ronda 3.

**Propietario único por tipo de tarea (Ronda 6):** las tareas de documentación y limpieza (README, dedupes de docs, retiro de artefactos) son las más propensas a colisión entre sesiones paralelas — solo UNA sesión por ronda las toca: o el Pulimiento asignado, o quien el Director designe expresamente. Las demás sesiones que detecten deuda documental la **reportan** en su informe en lugar de ejecutarla por su cuenta.

## 9. Registro de riesgos (mantenido por el Director)

El estado canónico de los riesgos vive en el último informe de ronda del Director. Síntesis vigente tras Ronda 6:

- **Cerrados:** R1 (README), R2 (multiagente instaurado), R5 (artefactos), R6 (tsc), R8 (commits), R9 (scaffolding, árbol mínimo), **R12 (Caddyfile `XTransformPort` — handle eliminado en Ronda 6, decisión documentada en el propio fichero; ningún código del producto lo usaba)**.
- **Acotados:** R3 (SSRF — guard verificado, limitación XFF documentada), R4 (auth opt-in `ADMIN_TOKEN` + rate limit; cierre total solo con despliegue multiusuario), R11 (build standalone obsoleto — el smoke con `--build` lo elimina como sorpresa).
- **Abiertos, vigilancia (clasificados en Ronda 6 a partir de los hallazgos de Bugs 17h49):**
  - **R13 — TOCTOU de DNS rebinding en `classifyTarget`** (baja-media): el guard resuelve y valida, pero `fetch` re-resuelve después; la mitigación completa exige pinning de la IP resuelta. Aceptable para el modelo de despliegue actual (no expuesto).
  - **R14 — `getZai()` sin timeout** (baja): si `ZAI.create()` colgara, `callZai` quedaría colgado. Nunca observado; el fix de degradación de la Ronda 5 cubre los fallos de las llamadas posteriores.
  - **R15 — XFF suplantable sin proxy** (media solo en despliegue directo a Internet): la primera entrada de XFF es controlable por el cliente; mitigación operativa con `ADMIN_TOKEN` + rate limit. Revisar si hay despliegue tras proxy que normalice XFF.
- **Vigilancia:** R10 (`DATABASE_URL` global del contenedor vs `.env`), R7 (historia git con .env/BD antiguos, sin secretos reales).
