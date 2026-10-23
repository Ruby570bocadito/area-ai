# claim: H-001-chunked-bypass-tope-cuerpo

- ID: SEG
- Fecha: 2026-10-23 11:50 (Europe/Madrid)
- Rutas: scripts/security-verify.mjs, docs/agentes/hallazgos/H-001-chunked-bypass-tope-cuerpo.md
- Detalle: verificar el hallazgo contra el build actual (el tope de stream chunked de `cuerpo-chunked` ya está en main), añadir caso de regresión «chunked sin credencial → 401» y resolver el estado del hallazgo.
