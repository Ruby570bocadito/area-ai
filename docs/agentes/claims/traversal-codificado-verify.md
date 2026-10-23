# Claim: traversal-codificado-verify

- **Agente**: SEG
- **Fecha/hora**: 2026-10-23 09:45 (Europe/Madrid)
- **Tarea**: ROADMAP (SEG) traversal-codificado-verify [S] — caso en security-verify de traversal codificado (`..%2f`), la variante que realmente llega al clasificador del lab (petición de IMP-1).
- **Rutas que voy a tocar**:
  - `scripts/security-verify.mjs` (zona SEG)
  - `src/lib/lab/runtime.ts` (fix mínimo si el sondeo confirma que la variante `%2e%2e%2f` escapa a la firma PATH_TRAVERSAL — el clasificador solo mira `..` literal)
- **No solapa con**: sin claims activos al inicio (verificado en docs/agentes/claims/).
