# claim: origin-allowlist-env

- ID: SEG
- Fecha: 2026-10-23 12:40 (Europe/Madrid)
- Rutas: src/lib/net/access.ts, tests/access.test.ts
- Detalle: `isSameOrigin` acepta además un Origin cuyo host coincida con `NEXT_PUBLIC_SITE_URL` cuando está definida (despliegues tras proxies que reescriben el Host); comportamiento por defecto intacto sin la variable; tests unitarios.
