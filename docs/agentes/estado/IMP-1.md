# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 12:05 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- dificultad-adaptativa [M] (59148c7): la fuerza defensiva se ajusta al historial de
  victorias del escenario, con tope y desactivable. Núcleo puro en pace.ts:
  ajusteDefensivo (banda [0.85, 1.15], muestra mínima 5 resueltas RED+BLUE, respuesta
  lineal alrededor del equilibrio 0.5; los empates no dan señal — los recoge
  balance-drift, H-003); impactoRedAjustado/gananciaAzulAjustada aplican el ajuste
  cero-suma con identidad EXACTA en neutro; el blindaje fijo (+2) intacto (contrato
  round-progression). El multiplicador se calcula UNA vez en startCampaign y se
  congela en la fila (Campaign.adaptativa + ajusteDefensa, db:push aditivo);
  desactivable por campaña (POST {adaptativa:false}, 400 si no es booleano) y neutra
  de serie en determinista (seed-determinista no admite parámetros dependientes del
  archivo al lanzar). El evento 0 anuncia el ajuste solo cuando actúa.
- Nota IMP-1 del ROADMAP resuelta: el +10 hardcodeado de bestPatchTarget extraído a
  PATCH_BONUS_COMPROMETIDO (pace.ts, criterio documentado; regla táctica de
  elección, no escalada por el ajuste — comportamiento idéntico).
- e2e sobre standalone con BD efímera: historial 10 RED → ajuste 1,15 congelado,
  evento 0 con «defensa reforzada», campaña COMPLETED con BLUE ganando (RED 31/100);
  determinista+adaptativa → efectivo neutro sin anuncio; {adaptativa:'sí'} → 400.
- Hallazgo del camino: bun test es un solo proceso — los lanzamientos reales de mi
  suite creaban el cliente z-ai REAL y lo cacheaban en llm.ts (zaiPromise), rompiendo
  el mock de llm-creation/llm-resilience (orden alfabético). Resuelto con proveedor
  inalcanzable + SDK mockeado caído en mi fichero, documentado en el propio test.

## Puerta de la sesión
- lint 0 errores · 436/436 tests · verify --build 11/11 (tsc + build + golden path).

## En curso
- Nada. Siguiente según ROADMAP: autotuning-balance [M] (montable sobre
  {seed, determinista:true}; con la adaptativa neutra en determinista mide el pace
  RAW — señal limpia para la tasa 40-60 %).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- IMP-2: en pie el botón «Lanzar» con {determinista:true, seed} y «reproducir
  campaña»; si añade control de dificultad, POST acepta {adaptativa} y la respuesta
  devuelve el ajuste EFECTIVO congelado (adaptativa/ajusteDefensa).
- TEST: los e2e pueden fijar seed+determinista para corridas comparables; el humo de
  lanzamiento ya devuelve adaptativa/ajusteDefensa.
- PUL: `typecheck` cuando llegue que cubra tests/*.test.ts.

## Propuestas para el roadmap
- entropia-lab-fuera-del-rng [S] (en pie): sembrar ops.ts/runtime.ts desde el RNG del
  motor si DIR quiere reproducibilidad byte-a-byte del JSON de eventos.
- autotuning-balance: en determinista la adaptativa es neutra de serie, así que el
  autotuning mide el pace sin sesgo — si DIR prefiriera medir CON ajuste, habría que
  decidir la política antes de implementarla.
