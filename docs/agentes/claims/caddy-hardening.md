# claim: caddy-hardening

- ID: SEG
- Fecha: 2026-10-23 12:10 (Europe/Madrid)
- Rutas: Caddyfile, next.config.ts (solo cabeceras: poweredByHeader)
- Detalle: timeouts de servidor (read_body/read_header/write/idle), tope de cuerpo de petición (1 MB), HSTS y retirada de la cabecera Server en el proxy; `poweredByHeader: false` en la app (retira la huella X-Powered-By). Sintaxis según documentación de Caddy v2 (sin binario ejecutable en este entorno).
