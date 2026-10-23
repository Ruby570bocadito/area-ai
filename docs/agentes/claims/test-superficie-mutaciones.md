# claim: test-superficie-mutaciones

- ID: SEG
- Fecha: 2026-10-23 14:25 (Europe/Madrid)
- Rutas: tests/superficie-mutaciones.test.ts (nuevo)
- Detalle: test estructural que DESCUBRE por directorio los handlers de mutación de src/app/api/ (POST/PUT/PATCH) y exige en cada uno los tres controles comportándose contra el handler real: 403 same-origin primero, 401 con cubo `admin:` consumiéndose hasta 429 (cierra el oráculo de fuerza bruta, HD3) y 429 impuesto también con token válido. Una mutación futura sin controles rompe la suite automáticamente.
