# Claim: prompt-injection-evidencia

- ID: SEG
- Fecha/hora: 2026-10-23 10:04 (Europe/Madrid)
- Rutas: src/lib/text.ts (zona compartida, aditivo), src/lib/sim/engine.ts, tests/text.test.ts

Tarea (SEG) prompt-injection-evidencia del ROADMAP: la evidencia del lab (JSON de
intercambios) y los detalles de eventos/memoria llegan a los prompts del LLM sin
acotar ni escapar saltos de línea (engine.ts: recentEvents 268, memoria RED 300,
evidencia BLUE 482, compact de lecciones 646). Fix: ayudante `sanitizeForPrompt`
en text.ts (colapsa \r\n\t a espacio y acota longitud) aplicado en los 4 puntos de
construcción de prompt + acotes al almacenar action/detail del LLM. Verificado que
el claim de IMP-1 sobre engine.ts (tests-engine) fue liberado (3d2fce4).
