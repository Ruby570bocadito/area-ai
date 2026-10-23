# Protocolo de trabajo de los agentes (v2)

Este documento sustituye al protocolo por rondas anterior. Ante cualquier discrepancia con un informe antiguo, prevalece este.

## 1. Ciclo por tarea (obligatorio)
1. `git pull --rebase origin main`
2. Lee `docs/agentes/ROADMAP.md`, `docs/agentes/OWNERSHIP.md`, los archivos de `docs/agentes/estado/` de los demás
   y los hallazgos abiertos dirigidos a tu ID en `docs/agentes/hallazgos/` (los CRÍTICO/ALTO van antes que el ROADMAP;
   usa el id del hallazgo como slug del claim; al arreglarlo, pon `Estado: resuelto-pendiente-verificación` en el archivo
   e indica el commit; NO lo borres, lo cierra TEST).
3. Elige UNA tarea de tu zona. Antes de empezar comprueba que no está hecha ya:
   `git log --since="3 days ago" --oneline -- <rutas>` y busca en el código lo que vas a crear.
   Si ya existe, no lo rehagas: pasa a otra tarea.
4. RECLAMA la tarea (cerrojo):
   - Crea `docs/agentes/claims/<slug-de-la-tarea>.md` con: tu ID, fecha/hora (Europe/Madrid), rutas que vas a tocar.
   - Si ya existe un claim con ese slug o con rutas solapadas y tiene menos de 3 horas, NO lo toques: elige otra tarea.
   - `git add` solo ese archivo, commit `chore(claim): <slug> (ID)`, `git push`.
   - Si el push es rechazado: `git pull --rebase`, vuelve a mirar claims. Si alguien reclamó antes, elige otra tarea.
5. Trabaja solo en las rutas reclamadas. Commits pequeños y atómicos, `tipo(ámbito): descripción`
   (tipos: feat, fix, chore, docs, test, refactor). Un commit por ámbito; nunca mezcles feature + limpieza + docs.
6. Antes de CADA push: `git pull --rebase origin main`, ejecuta la puerta de calidad (sección 3) y push.
   - Push rechazado: repite pull --rebase y push (hasta 3 veces).
   - Conflicto: resuélvelo conservando la intención de AMBOS cambios. Si dos variantes implementan el mismo requisito,
     compáralas lado a lado, elige una y elimina la otra a mano; el auto-fusionado de git NO es verificación.
     Prohibido resolver conflictos con sustituciones regex. Relee entero cada fichero en conflicto. Nunca `--force`,
     nunca descartes el trabajo ajeno.
7. Al terminar: borra tu claim (commit `chore(claim): release <slug>`), actualiza tu `estado/<ID>.md`, push.
8. Repite desde el paso 1 con otra tarea mientras queden en tu zona, hasta cumplir el alcance de la sesión.

## 2. Zonas
Solo modificas, mueves o borras archivos de tu zona (ver OWNERSHIP.md). Si necesitas un cambio fuera de ella,
no lo hagas: anótalo en la sección "Peticiones" de tu estado para el dueño de esa zona.
Excepción: un fallo que rompe el build para todos; arréglalo mínimo y menciónalo.

## 3. Puerta de calidad
- Antes de cada push (siempre): `bun run lint` (0 errores) y `bun run test` (suite unitaria en `tests/`).
- Antes de liberar una tarea que haya tocado código de producto: `bun run verify --build` (tipos + unidades + servidor de
  producción + golden path; es el canon único, `bun run smoke` delega en el mismo `tests/smoke.mjs`).
- Si la tarea toca `src/lib/net/`, `Caddyfile`, `next.config.ts` o cualquier superficie de seguridad: además
  `bun run build && bun scripts/security-verify.mjs` sobre el standalone recién construido.
- Si la tarea toca UI/assets de forma masiva (tokens, `globals.css`) o una cifra del canon no cuadra con lo esperado:
  `rm -rf .next/cache` antes del build (la caché de Turbopack puede servir CSS antiguo).
- Módulo de seguridad nuevo = test el mismo día. Funciones puras nuevas de `src/lib/` deberían llegar con su test.
- Cambia comportamiento visible, variables de entorno o scripts: actualiza `README.md` y `.env.example` en la misma tarea
  (si README es zona de PUL, déjale la petición en tu estado y avisa en el commit).
- Variable de entorno nueva: se documenta en `.env.example` y en la tabla de variables del README.

## 4. Higiene del repo
- Borradores, volcados, logs y pruebas sueltas: SOLO en `.agent-tmp/` (ignorado por git). Nunca en la raíz ni en carpetas del proyecto.
- No crees archivos nuevos de documentación salvo que el Director lo pida. Los informes viven en `estado/<ID>.md` (se sobrescriben).
  `worklog.md` queda congelado: no se añaden entradas (el historial lo guarda git).
- No dejes código comentado, TODOs sin resolver, mocks ni datos de ejemplo fuera de tests.
- Autoría: nada que identifique a un asistente como autor en commits, código, comentarios o docs (sin coautorías ni firmas de
  agente). El dominio del producto (agentes IA, LLM, proveedor OpenAI-compatible, `z-ai-web-dev-sdk`) es legítimo y se queda.
  Identidad git: la ya configurada, no la cambies.
- Cualquier dependencia nueva: justificarla en el commit y solo desde el registro/repo oficial; `package.json` y `bun.lock` los toca PUL.
- Evidencia visual (capturas/GIF): solo en `docs/screenshots/`, nombre semántico en español (`panel-de-mando.png`),
  enlazada desde el README. GIF < 5 MB (≤ 8 fps, ancho ≤ 760 px). Se genera con `scripts/generate-visuals.mjs`.

## 5. Seguridad por defecto
- Lecturas `GET` abiertas (datos de simulación, sin secretos); mutaciones `POST` protegibles con `ADMIN_TOKEN` opt-in + rate limit + same-origin + tope de cuerpo.
- Todo `fetch` a URL aportada por el usuario pasa por `src/lib/net/target-guard.ts` (SSRF). No se añaden fetches salientes sin pasar por él.
- El laboratorio solo escucha en `127.0.0.1`. Ninguna función apunta a hosts externos ni a redes ajenas: toda campaña ocurre contra el lab local.
- Las claves de proveedor nunca van al repo y la API solo las devuelve enmascaradas.

## 6. Ejecución en paralelo en la misma máquina
Cada agente en su propio `git worktree` (ver "Cómo lanzarlos") con su propio `bun install`, su propio `.env` y una BD propia
(`DATABASE_URL` con ruta ABSOLUTA dentro de su worktree; `*.db` ya está ignorado). Puertos propios para no pisarse:

| ID | SMOKE_PORT | LAB_PORT | puerto de dev |
|----|-----------|----------|---------------|
| IMP-1 | 3111 | 4411 | 3211 |
| IMP-2 | 3112 | 4412 | 3212 |
| SEG | 3113 | 4413 | 3213 |
| PUL | 3114 | 4414 | 3214 |
| TEST | 3115 | 4415 | 3215 |

Servidor de desarrollo: `bunx next dev -p <puerto de dev>` (el script `bun run dev` fija el 3000). `scripts/security-verify.mjs`
usa el puerto fijo 3105: solo SEG lo ejecuta hasta que PUL lo parametrice (tarea en el ROADMAP).

## 7. Informe vivo: `docs/agentes/estado/<ID>.md` (máx. 40 líneas, se sobrescribe)
Secciones: Hecho (últimas 24 h) · En curso · Bloqueado · Peticiones a otras zonas · Propuestas para el roadmap.

## 8. Tono
Los informes son técnicos y breves. No añadas avisos ni recordatorios que no pertenezcan a tu tarea.
