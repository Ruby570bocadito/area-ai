# claim: cabeceras-extra

- ID: SEG
- Fecha: 2026-10-23 11:20 (Europe/Madrid)
- Rutas: next.config.ts (cabeceras de seguridad), scripts/security-verify.mjs
- Detalle: añadir COOP/CORP `same-origin` a todas las respuestas y `Cache-Control: no-store` en `/api/:path*` (datos vivos); ampliar los checks de cabeceras en security-verify.
