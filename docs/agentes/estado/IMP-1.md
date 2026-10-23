# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 10:50 (Europe/Madrid) · Sesión: VERDE

## Hecho (últimas 24 h)
- tests-engine [L] COMPLETADA (f3c40e6): 37 tests que fijan el contrato del motor antes de refactorizar.
  engine.ts: RNG sembrable (setEngineSeed; sin semilla = Math.random), exportación de ayudantes puros y
  extracción de redShouldChain + accumulateProgress (sobre clampProgress de victory.ts).
- tests-lab-runtime [L] COMPLETADA (5f08f55): 41 tests contra el servidor HTTP real del lab en puerto libre
  efímero (red por segmentos, sesiones, firewall, parcheo, aislamiento, 10 firmas, SIEM, OSINT, diario).
  HALLAZGO + fix en ops.ts: redIntrusion leía las vulns del InfraNode estático (código muerto: las ramas
  SQLI/BOLA jamás casaban) en vez del estado real del lab — ahora los parches de BLUE cierran la vía en
  vivo. Test de regresión incluido.
- tests-progresion-conocimiento [M] COMPLETADA (7000c25): 21 tests — curva de XP (frontera 60/191,
  invariante de ida y vuelta, anti-inflación), fórmula 60/30/10 del conocimiento (pesos exactos, saturación,
  acotado [0,1] en rejilla completa) y provider-config (maskKey, prioridad BD→env→zai, caché TTL, guardado
  real en BD con limpieza).
- Ticks en ROADMAP aplicados a las tres tareas ALTA de IMP-1. Fase 0 (red de seguridad de tests del motor)
  desbloquea refactor-engine-fases y tests de refactor.

## Puerta de la sesión
- lint 0 errores · 328/328 tests · verify --build 11/11 con caché limpia (tras cada tarea con producto).

## En curso
- Nada. Siguiente tarea de mi zona según ROADMAP: seed-determinista (setEngineSeed ya está listo para ello).

## Bloqueado
- Nada.

## Peticiones a otras zonas
- SEG/TEST: el fix de ops.ts amplifica la vía de intrusión SQLI/BOLA de RED (antes muerta) — la dinámica de
  campañas cambia (RED más fuerte en fases de contacto). Vigilar tasa de victoria con autotuning-balance.
- SEG: security-verify podría incluir un caso de traversal codificado (..%2f), que es la variante que
  realmente llega al clasificador del lab.
- PUL: cuando añadas `typecheck` a package.json (script-typecheck), que cubra también tests/*.test.ts.

## Propuestas para el roadmap
- seed-determinista ya tiene la mitad del camino: guardar `seed` en Campaign y pasarlo a setEngineSeed al
  arrancar runCampaign.
- redShouldChain/accumulateProgress son la frontera natural del futuro módulo "combate" de
  refactor-engine-fases; sugerible partir el refactor por ahí.
- bestPatchTarget prioriza comprometidos y criticidad con +10 hardcodeado: "dificultad-adaptativa" podría
  calibrar ese factor.
