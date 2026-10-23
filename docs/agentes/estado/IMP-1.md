# IMP-1 — Motor, laboratorio, API y datos

Actualizado: 2026-10-23 10:35 (Europe/Madrid)

## Hecho (últimas 24 h)
- tests-engine [L] COMPLETADA (f3c40e6): 37 tests que fijan el contrato del motor antes de refactorizar.
  engine.ts: RNG sembrable (setEngineSeed; sin semilla = Math.random), exportación de ayudantes puros y
  extracción de redShouldChain + accumulateProgress (sobre clampProgress de victory.ts). Puerta íntegra.
- tests-lab-runtime [L] COMPLETADA (5f08f55): 41 tests contra el servidor HTTP real del lab en puerto libre
  efímero (red por segmentos, sesiones, firewall, parcheo, aislamiento, 10 firmas, SIEM, OSINT, diario).
  HALLAZGO + fix en ops.ts: redIntrusion leía las vulns del InfraNode estático (código muerto: las ramas
  SQLI/BOLA jamás casaban) en vez del estado real del lab — ahora los parches de BLUE cierran la vía en
  vivo. Test de regresión incluido. Puerta: lint 0 · 307/307 · verify --build 11/11 (caché limpia).
- Ticks en ROADMAP aplicados a tests-engine y tests-lab-runtime.

## En curso
- tests-progresion-conocimiento [M]: tests de progression.ts, knowledge-score.ts y provider-config.ts.

## Bloqueado
- Nada.

## Peticiones a otras zonas
- PUL: cuando añadas `typecheck` a package.json (script-typecheck), valida también tests/*.test.ts.
- SEG/TEST: el fix de ops.ts amplifica la vía de intrusión SQLI/BOLA de RED (antes muerta) — la dinámica
  de campañas cambia (RED más fuerte en fases de contacto). Vale la pena vigilar la tasa de victoria en
  el próximo autotuning-balance.

## Propuestas para el roadmap
- setEngineSeed deja el motor listo para seed-determinista: guardar `seed` en Campaign y pasarlo a
  setEngineSeed al arrancar runCampaign.
- redShouldChain/accumulateProgress son la frontera natural del futuro módulo "combate" de
  refactor-engine-fases; sugerible partir el refactor por ahí.
- bestPatchTarget ya prioriza comprometidos y criticidad: "dificultad-adaptativa" podría calibrar el
  factor +10 en lugar de hardcodearlo.
- PATH_TRAVERSAL solo es alcanzable vía traversal codificado (..%2f): los `..` literales los normaliza
  el estándar URL antes de llegar al clasificador — comportamiento correcto, pero conviene que
  security-verify incluya un caso de traversal codificado.

