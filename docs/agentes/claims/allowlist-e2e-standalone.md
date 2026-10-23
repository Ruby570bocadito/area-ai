# claim: allowlist-e2e-standalone

- ID: SEG
- Fecha: 2026-10-23 19:55 (Europe/Madrid)
- Rutas: tests/e2e/allowlist-origen.e2e.mjs (NUEVO), docs/agentes/estado/SEG.md
- Detalle: caso e2e de la allowlist de origen de isSameOrigin (tarea origin-allowlist-env, 407c7aa — hoy cubierta solo por unit tests, ROADMAP SEG-P2). Arnés al estilo de tests/e2e/entorno-adverso.e2e.mjs: tres instancias standalone efímeras en el puerto SEG 3113 (secuenciales, muerte verificada), cada una con BD propia (db push sobre fichero en .agent-tmp, sin tocar db/custom.db) y assets estáticos copiados. E1 control SIN NEXT_PUBLIC_SITE_URL (Origin de otro host → 403; sin Origin → 200: la barrera no está rota); E2 CON NEXT_PUBLIC_SITE_URL=https://panel.example (Origin del sitio → 200 atravesando la allowlist; Origin de otro host → 403: la allowlist no abre la puerta a cualquiera); E3 con la variable MALFORMADA (Origin del «sitio» → 403: una URL de sitio malformada no relaja nada; sin Origin → 200). Sonda: POST /api/settings (primera barrera same-origin antes de token y bucket, orden canónico 403→429→401→413). Sin producto tocado: el código bajo prueba es el que ya está en main.
