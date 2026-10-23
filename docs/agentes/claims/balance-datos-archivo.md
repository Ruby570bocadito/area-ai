# Claim: balance-datos-archivo

- ID: IMP-1
- Fecha/hora: 2026-10-23 12:05 (Europe/Madrid)
- Rutas: scripts/balance-drift.mjs (nuevo), src/lib/sim/balance-drift.ts (nuevo),
  tests/balance-drift.test.ts (nuevo), docs/agentes/ROADMAP.md (tick), docs/agentes/estado/IMP-1.md

Veredicto de deriva de balance D30 con las campañas ya archivadas (coste cero en
LLM, no se lanza ninguna campaña): módulo puro de veredicto (umbral ≥70 % del
mismo ganador en 15+ finalizadas), script de lectura de BD y tests unitarios.
