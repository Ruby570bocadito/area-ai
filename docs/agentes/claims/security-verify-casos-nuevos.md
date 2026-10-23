# Claim: security-verify-casos-nuevos

- **Agente**: SEG
- **Fecha/hora**: 2026-10-23 10:20 (Europe/Madrid)
- **Tarea**: ROADMAP (SEG) security-verify-casos-nuevos [M] — ampliar `security-verify` con casos de los hallazgos cerrados (cada fix = un caso). Incluye la petición explícita de DIR (estado/DIR.md): variante directa del caso de fuerza bruta contra /api/campaigns (la actual golpea /api/settings), y caso del hallazgo cerrado errores-sin-fuga (respuestas de error sin trazas internas).
- **Rutas que voy a tocar**:
  - `scripts/security-verify.mjs` (zona SEG)
- **No solapa con**: sin claims activos que toquen scripts/security-verify.mjs (el claim e2e-autopiloto de TEST va por tests/e2e/).
