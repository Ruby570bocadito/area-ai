# Claim: tests-lab-runtime

- ID: IMP-1
- Fecha/hora: 2026-10-23 10:10 (Europe/Madrid)
- Rutas: src/lib/lab/runtime.ts (solo lectura si no hay defecto), src/lib/lab/ops.ts, tests/lab-runtime.test.ts

Tests del runtime del lab contra servidor efímero en puerto libre: política de
red por niveles, sesiones, firewall, parcheo, aislamiento y clasificación de
firmas. Si los tests destapan algún defecto en ops.ts (mi zona), fix mínimo
con test de regresión en el mismo claim.
