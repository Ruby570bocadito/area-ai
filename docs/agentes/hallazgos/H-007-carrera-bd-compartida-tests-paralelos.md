# H-007 — Carrera entre ficheros de test sobre la BD SQLite compartida (paralelismo de bun test)

Estado: abierto (dirigido a IMP-1 — el fichero más expuesto es su `tests/validacion-lanzamiento.test.ts`; NOTA DE COORDINACIÓN: IMP-1 tiene el claim H-006 en vuelo, aplicar el fix tras liberarlo para no colisionar)
Abierto: 2026-10-23 (TEST, sesión 11, durante la simulación local del workflow ci-basico)

## Síntoma

`bun test tests/` (paralelo, defecto: un worker por núcleo) falla de forma
intermitente SIEMPRE en los mismos 2 tests — `H-004 caso 2` de
`tests/validacion-lanzamiento.test.ts` («scenarioId inexistente → 400» y
«scenarioId de tipo erróneo (número) → 400»):

- Sesión 10 de TEST: 478/480 en una puerta (2 fallos aquí), 9/9 en aislado,
  480/480 ×2 en las puertas siguientes — anotado como observación «puntual».
- Sesión 11 de TEST: **3 corridas consecutivas rojas** (497/499 cada una,
  siempre los mismos 2 tests) corriendo exactamente lo que ejecutará el
  workflow ci-basico. Ya no es puntual: con 29 ficheros / 499 tests la
  ventana de carrera se abre con regularidad.

## Mecanismo (dos firmas de fallo observadas en el log)

Los tests del caso 2 hacen POST reales contra la ruta `api/campaigns`, que
pasa por `startCampaign` (src/lib/sim/engine.ts) ANTES de llegar al
`resolverEscenario` que produce el 400 esperado. Ese tramo consulta estado
GLOBAL de la BD compartida (`DATABASE_URL` única para todo `bun test`):

1. **Guard RUNNING (engine.ts:129-131)** — si otro fichero de test dejó una
   campaña RUNNING comprometida (p.ej. `tests/huerfanas-recuperacion.test.ts`
   crea huérfanas RUNNING por diseño), el POST recibe 409 «Ya hay una campaña
   en curso» en vez del 400 esperado.
2. **Semilla no visible / carrera de ensureSeed (engine.ts:133-134)** — el
   POST llega a `db.scenario.findMany()` y encuentra 0 filas →
   `No hay escenarios disponibles` (500 sin clasificar). Con múltiples
   procesos arrancando a la vez (parallel-delay por defecto: 5 ms), varios
   ficheros disparan `ensureSeed` concurrentemente sobre el mismo SQLite: el
   lector ve el snapshot previo a la escritura del otro proceso.

Bajo `--parallel` cada fichero corre en SU proceso worker: comparten el
fichero SQLite, no el estado de módulo. Las precondiciones que
`validacion-lanzamiento` da por hechas (semilla visible, ninguna RUNNING)
son estado global que OTROS ficheros mutan concurrentemente. Las aserciones
relativas del fichero (conteos antes/después, marcadores propios) son
robustas — por eso solo fallan los tests que dependen de precondiciones
absolutas del arranque.

## Repro (determinista en ambos sentidos)

```bash
# ROJO (3/3 en la sesión 11): paralelo por defecto
DATABASE_URL="file:$PWD/db/ci.db" bun test tests/

# VERDE (2/2): ficheros en serie, --isolate implícito (estado de módulo
# fresco por fichero — la semántica de aislamiento que cada fichero asume;
# «en aislado» siempre ha sido verde). Mismo coste: ~23 s vs ~22 s.
DATABASE_URL="file:$PWD/db/ci.db" bun test tests/ --parallel=1
```

## Mitigación ya aplicada (CI, zona TEST)

El workflow `ci-basico` (.github/workflows/ci-basico.yml) ejecuta la unidad
con `bun test tests/ --parallel=1` — serializada por fichero. 499/499 ×2
verificado en la sesión 11. Localmente los agentes pueden seguir usando
`bun run test` (paralelo) sabiendo que esos 2 tests pueden irse rojos por
esta carrera, no por regresión.

## Fix de fondo propuesto (IMP-1)

Aislar la BD del fichero expuesto, patrón de las suites e2e (auto-bootstrap,
mismo arnés que golden-path): en `validacion-lanzamiento.test.ts`, ANTES del
import dinámico de la ruta —

```ts
process.env.DATABASE_URL ??= 'file:' + resolve(import.meta.dir, '../db/test-validacion.db')
// + spawnSync('bunx', ['prisma', 'db', 'push', '--skip-generate'],
//             { env: { ...process.env, DATABASE_URL: <esa ruta> } })
```

Así el fichero deja de depender del estado global y sus aserciones de
ausencia de side effects se vuelven herméticas (nadie más escribe ahí).
Alternativa menor (sin nueva BD): reintentar el POST si el status es 409 o
el cuerpo menciona «No hay escenarios disponibles» — descartada como fix
principal porque disimula la carrera en vez de eliminarla. Tras el fix, el
workflow puede volver a `bun run test` paralelo si se quiere (una línea).

## Impacto

- CI: con la mitigación, verde estable. Sin ella, el workflow ci-basico
  sería rojo con alta frecuencia desde el primer día.
- Local: irrelevante para desarrolladores que corren ficheros concretos;
  relevante para puertas de suite completa (usar `--parallel=1` hasta el fix).

## Adendum (sesión 11, tras la 15ª pasada de DIR — árbol fusionado con el fix H-006 bbd1b28)

La suite creció a 514 tests / 30 ficheros (infraestructura-lanzable.test.ts
de IMP-1: 15 tests con el repro de H-006 — siembra un escenario roto
`{"nodes":[]}` en la BD compartida y lo retira en afterAll). Sobre ese árbol,
con `--parallel=1`:

- 1 corrida roja observada (512/514 — los 2 fallos NO llegaron a capturarse
  con nombre; la corrida siguiente y otras 5 más fueron 514/514).
- Balance honesto: **1 roja / 6 verdes** serializado. El flake persiste
  incluso sin paralelismo de ficheros — la sospechosa principal es el estado
  global que el fichero nuevo introduce (escenario roto visible para las
  rutas que eligen escenario al azar de otros ficheros, y/o colas de
  arranque de sus 15 tests con lanzamientos SIM). Sin nombres capturados no
  se adjudica causa: el workflow ci-basico correrá la suite completa en cada
  push y devolverá los nombres con su log completo cuando recurra.
- Refuerza el fix de fondo (BD por fichero + semillas marcadas retiradas en
  afterAll como YA hace infraestructura-lanzable) y añade una regla nueva
  para autores de tests: los ficheros que siembran escenarios/campañas
  globales deben asumir que OTROS ficheros los ven en el mismo instante.
