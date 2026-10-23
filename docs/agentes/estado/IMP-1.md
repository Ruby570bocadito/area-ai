# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 14:20 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- refactor-engine-fases [L] (2e4516b): engine.ts (1075 líneas) partido en módulos por
  concepto SIN cambiar comportamiento — engine-rng (RNG sembrable y semillas),
  engine-select (selección de agentes/nodos), engine-combate (momentum RED, escalas,
  mapeos fase→firma/segmento/hipótesis, bestPatchTarget, fallbacks deterministas) y
  engine-cierre (finalizeCampaign + fallbackLessons). engine.ts queda como orquestador
  (startCampaign, memoria, bucle de rondas, huérfanas) y RE-EXPORTA el contrato público
  histórico: cero cambios en consumidores ni tests. Equivalencia probada en tres frentes:
  (1) diff textual runCampaign viejo vs nuevo = solo el cierre delegado;
  (2) finalizeCampaign = transcripción íntegra del bloque antiguo (diff limpio salvo firma);
  (3) e2e de reproducibilidad sobre standalone con BD efímera: dos campañas seed 2026
  determinista → 31 eventos con campos de motor idénticos y mismo desenlace (DRAW 62/72,
  exactamente el de la verificación de seed-determinista).
- Hallazgo del camino (PREEXISTENTE, no regresión): la entropía del laboratorio vive
  FUERA del RNG del motor — randomBytes del payload ARMADO (ops.ts:159) e ids de sesión
  con Math.random (runtime.ts:391) hacen variar `command`/`evidence` en 24 de 31 eventos
  entre corridas idénticas. La reproducibilidad exacta de seed-determinista se mantiene
  a nivel de motor (acción/agente/resultado/impacto/nodo/desenlace).

## Puerta de la sesión
- lint 0 errores · 396/396 tests · verify --build 11/11 (tsc + build + golden path).

## En curso
- Nada. Siguiente según ROADMAP: dificultad-adaptativa [M] (nota: calibrar el +10
  hardcodeado de bestPatchTarget) o autotuning-balance [M] (ya montable sobre
  {seed, determinista:true}).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- IMP-2: sigue en pie la petición del botón «Lanzar» con {determinista:true, seed} y
  «reproducir campaña» reenviando la semilla archivada.
- TEST: el smoke/e2e puede fijar seed+determinista para corridas comparables.
- PUL: `typecheck` cuando llegue que cubra tests/*.test.ts.

## Propuestas para el roadmap
- entropia-lab-fuera-del-rng [S]: si DIR quiere reproducibilidad byte-a-byte del JSON de
  eventos (hoy: solo campos de motor), sembrar también ops.ts/runtime.ts desde el RNG
  del motor (payload ARMADO, ids de sesión); alternativa: documentarlo como límite.
- autotuning-balance ya montable sobre {seed, determinista:true}: N campañas comparables
  por escenario, cero coste LLM, tasa de victoria exacta.
