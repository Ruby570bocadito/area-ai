# Claim: fuzz-normalizadores

- **Agente**: SEG
- **Fecha/hora**: 2026-10-23 10:50 (Europe/Madrid)
- **Tarea**: ROADMAP (SEG) fuzz-normalizadores [M] — pruebas de fuzzing de `taxonomy`, `text` y parseo de URL (lab) en tests/.
- **Rutas que voy a tocar**:
  - `tests/fuzz-normalizadores.test.ts` (fichero NUEVO; no toca tests existentes)
- **Nota de alcance**: los fixes que el sondeo motivó (clasificador con path decodificado y decodeLabPart en `src/lib/lab/runtime.ts`) ya entraron con el claim traversal-codificado-verify (586eb35→9ec9d4e); este claim solo añade la red de fuzz que los perpetúa.
- **No solapa con**: sin claims activos que toquen tests/ (e2e-autopiloto de TEST va por tests/e2e/, ficheros *.e2e.mjs).
