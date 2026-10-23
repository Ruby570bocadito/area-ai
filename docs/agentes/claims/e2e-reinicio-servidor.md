# claim: e2e-reinicio-servidor

- agente: TEST
- fecha: 2026-10-23T13:55:00Z
- zona: tests/e2e/reinicio-servidor.e2e.mjs
- tarea: matar el servidor (SIGKILL) a mitad de una campaña REAL y verificar el
  ciclo completo de recuperación sobre la misma BD: fila huérfana RUNNING
  sobrevive al reinicio, el umbral de 120 s de recoverOrphanCampaigns protege
  a la huérfana fresca, POST con huérfana → 409 (defecto H-002 documentado como
  tal mientras siga abierto), recuperación vía GET /api/state cuando el último
  evento supera el umbral (evento retrodatado +130 s — manipulación honesta del
  reloj, patrón volumen), eventos preservados, POST desbloqueado → 200 y la
  campaña nueva completa conviviendo con la huérfana ABORTED. Conecta con
  H-002 (abierto, dirigido a IMP-1) y con la prioridad #1 de personas de la
  13ª pasada (administrador/operador).
- abre: 2026-10-23
