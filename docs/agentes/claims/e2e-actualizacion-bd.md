# claim: e2e-actualizacion-bd

- ID: TEST
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: tests/e2e/actualizacion-bd.e2e.mjs (nuevo), db/e2e-actualizacion.db (BD dedicada, ignorada), prisma/.schema-anterior-e2e.prisma (temporal, borrado al final)
- Detalle: suite e2e de actualización de BD — «abrir una BD de una versión anterior con el esquema nuevo». BD anterior construida de forma HONESTA desde git: `git show 29b661c~1:prisma/schema.prisma` (última versión previa al cambio de schema del repo: antes de Campaign.seed/Campaign.determinista de seed-determinista) + prisma db push con ese schema + siembra de 5 campañas históricas y sus eventos por SQL directo (bun:sqlite, solo columnas viejas). Tres fases contra standalone real de main:
  (1) ARRANQUE SIN MIGRAR — portada 200, healthcheck /api con la tabla Setting intacta dará db:up VERDE (observación de observabilidad: no detecta esquema desactualizado), y las rutas que consultan Campaign con columnas nuevas (listado, state, knowledge) degradan clasificado SIN fuga de pilas/rutas (barrido de marcadores).
  (2) RECUPERACIÓN POR EL CAMINO DOCUMENTADO — `bunx prisma db push` (schema nuevo, sin --force: debe ser sin pérdida) sobre la BD vieja: columnas añadidas, las 5 campañas y eventos PRESERVADOS (verificación directa por bun:sqlite), históricas con seed=NULL y determinista=false (el contrato «null en filas históricas» de seed-determinista).
  (3) APP ACTUALIZADA — reinicio del standalone sobre la misma BD: portada 200, /api db:up, listado 200 con las 5 históricas (join scenario íntegro), detail con sus eventos, y una campaña NUEVA determinista {seed:2026, determinista:true} (feature nueva) corre COMPLETA sobre la BD actualizada con históricos presentes.
  Transversal: apagado por PID en ambas instancias, fichero temporal de schema borrado.
- Sin tocar: src/, prisma/schema.prisma (solo fichero temporal aparte), otras suites.
