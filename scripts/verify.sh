#!/bin/bash
# ─────────────────────────────────────────────────────────────
# verify.sh — verificación de cierre de ronda de area·ai
#   1) Tipos (tsc --noEmit)
#   2) Build de producción (standalone)
#   3) Arranque del servidor
#   4) Golden path: GET /api/state responde { ok: true }
#
# Uso:  bun run verify            (verificación completa)
#       VERIFY_SKIP_BUILD=1 bun run verify   (salta el build si ya existe)
#
# No toca tu base de datos: usa una BD de verificación dedicada.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${VERIFY_PORT:-3100}"

echo "▸ 1/4 Tipos (tsc --noEmit)"
bunx prisma generate >/dev/null 2>&1   # asegura el cliente Prisma (barato si está cacheado)
bunx tsc --noEmit

if [ "${VERIFY_SKIP_BUILD:-0}" != "1" ]; then
  echo "▸ 2/4 Build de producción"
  bun run build >/dev/null
else
  echo "▸ 2/4 Build omitido (VERIFY_SKIP_BUILD=1)"
fi

echo "▸ 3/4 Base de datos de verificación"
mkdir -p db
# Ruta ABSOLUTA: evita la ambigüedad de resolución de rutas relativas entre
# `prisma db push` (relativa al esquema) y el runtime standalone (relativa a su raíz).
VERIFY_DB_ABS="$(pwd)/db/verify-temp.db"
export DATABASE_URL="file:${VERIFY_DB_ABS}"
bunx prisma db push --skip-generate >/dev/null 2>&1

echo "▸ 4/4 Arranque + golden path (GET /api/state en puerto ${PORT})"
# Comprueba que el puerto esté libre (evita hablar con un servidor huérfano de una ejecución anterior)
if curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}/api/state" 2>/dev/null; then
  echo "✗ verify FALLÓ: el puerto ${PORT} ya está en uso (¿servidor huérfano?). Usa VERIFY_PORT=<puerto> para elegir otro."
  exit 1
fi
NODE_ENV=production PORT="${PORT}" bun .next/standalone/server.js >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" 2>/dev/null; pkill -P "${SERVER_PID}" 2>/dev/null; true' EXIT

STATE_OK=0
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/api/state" -o /tmp/verify-state.json 2>/dev/null; then
    grep -q '"ok":true' /tmp/verify-state.json && STATE_OK=1 && break
  fi
  sleep 1
done

if [ "${STATE_OK}" != "1" ]; then
  echo "✗ verify FALLÓ: /api/state no respondió { ok: true } en 30 s"
  exit 1
fi

rm -f "${VERIFY_DB_ABS}" "${VERIFY_DB_ABS}-journal" /tmp/verify-state.json
echo "✓ verify OK: tipos, build, arranque y golden path correctos"
