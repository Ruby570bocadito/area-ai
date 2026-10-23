# claim: logs-sin-secretos

- ID: SEG
- Fecha: 2026-10-23 15:05 (Europe/Madrid)
- Rutas: src/lib/ (auditoría; fixes mínimos si procede), tests/ si el cierre exige tripwire
- Detalle: verificar que ningún log (console.*) ni informe exportado contiene claves, tokens ni cabeceras sensibles; fix mínimo de lo que aparezca y perpetuación si cabe.
