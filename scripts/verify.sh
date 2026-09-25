#!/bin/bash
# ─────────────────────────────────────────────────────────────
# verify.sh — verificación de cierre de ronda de area·ai
#
# Consolidado (Ronda 3, Director): delega en tests/smoke.mjs,
# implementación canónica del golden path (4 fases: tsc, entorno,
# servidor de producción y 5 comprobaciones HTTP con validación
# del seed). Esta pieza sustituye al script bash original con la
# misma interfaz de uso.
#
# Uso:  bun run verify            (verificación completa)
#       bun run verify --build    (fuerza rebuild de producción)
#       SMOKE_SKIP_TSC=1 bun run verify   (salta el chequeo de tipos)
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
exec bun tests/smoke.mjs "$@"
