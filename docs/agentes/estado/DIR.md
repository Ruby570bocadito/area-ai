# estado/DIR — Director

Actualizado: 2026-10-23 (15ª revisión del día, Europe/Madrid) · Estado: VERDE

## Hecho (última hora)
- La ronda ABRIÓ como vigilancia pura (2 claims frescos de ~12 min) y SE CONVIRTIÓ EN VERIFICACIÓN EN VIVO: 7 commits aterrizaron mientras DIR ejecutaba su puerta — FIX DE H-006 (bbd1b28), enlace-permanente-ronda (09cc494), releases de ambos claims, informes vivos de IMP-1 y TEST reclamó ci-basico (a1f9c7d, cross-zone autorizada en la 12ª). Rebase limpio y verificación de todo.
- ADJUDICACIÓN DE DISPUTA ENTRE AGENTES (1ª del protocolo v2): IMP-2 alertó 18 fallos del lab-runtime.test.ts de IMP-1 en suite completa; IMP-1 sostuvo 41/41 aislado y 514/514 completas. DIR ejecutó la suite completa sobre el árbol fusionado: 514/514, 0 fallos (14 920 expect, 30 ficheros; composición verificada: 499 base + 15 de infraestructura-lanzable; lab-runtime ya estaba en el árbol de la 14ª vía 5f08f55). VEREDICTO: IMP-1 tiene razón; la alerta de IMP-2 no reproduce en main (probablemente específica de su worktree) y queda como observación — si reproduce determinístico, asunto de aislamiento para TEST. SMOKE_SKIP_UNIT confirmada bandera oficial (smoke.mjs:83): la cita 10/10 de IMP-2 es correcta, sin corrección esta vez.
- H-006 → RESUELTO-VERIFICADO (5º ciclo completo hallazgo→fix→verificación): código revisado línea a línea (parsearInfraestructura con el contrato EXACTO de bootLab y grafo entero rechazado si UN nodo falla; elegirEscenarioLanzable con diagnósticos verdaderos 400/400/503 antes del create; capa defensiva en runCampaign; contrato re-exportado), suite 514/514, interacción cruzada verificada por diseño (e2e-actualizacion-bd nació H-006-consciente: INFRA_HIST válida con comentario que cita el hallazgo) y e2e-reinicio-servidor RE-EJECUTADA POR DIR sobre standalone recién construido (puertos 3118/4418): 19/19 VERDE con campaña nueva COMPLETED (34 eventos). La persona #1 (administrador/operador) queda SIN pendientes.
- enlace-permanente-ronda RATIFICADO Y TICKADO: 5 ficheros exactos del claim, compartidas text.ts/api-types con diff 0, /arena con diff 0, premisas en el código (regex /^[1-9]\d*$/, precedencia evento>ronda, replaceState nativo, ampliación de ventana Math.max, aro ámbar, aria-pressed, props opcionales), bonus de traducción intra-zona correcto.
- BADGE DE TESTS ARREGLADO POR DIR (cross-zone PUL, agrupado con la ratificación de H-006 como se prometió al abrir la ronda — ambos claims IMP liberados y el de TEST limitado a .github/): badge y cifras del README 411 → 514 con los módulos nuevos nombrados; la deuda acumulaba 4 obsolescencias (386→396→411→499/514).
- DOS IDEAS P3 nuevas: badge-tests-autoverificado (comprobador/regenerador del badge en la puerta; conecta con ci-basico) y cifras-fuente-unica (script que emita las cifras de la puerta a JSON efímero — ataca la raíz de las 8 correcciones de cita).

## En curso
- Vigilancia: claim ci-basico de TEST (a1f9c7d) — al aterrizar desbloquea browser-e2e-ci y con ella la prioridad #3 de personas (móvil/accesibilidad). IMP-1 anuncia ranking-elo como siguiente tarea.
- Próxima pasada: ratificar ci-basico cuando aterrice (re-ejecución del ciclo CI o revisión del YAML según lo que traiga) + surveillance de ranking-elo + H-003 sigue esperando datos de balance-drift (D30).

## Bloqueado
- license-decision: esperando la decisión del PROPIETARIO (¿MIT, Apache-2.0 u otra?) — único bloqueador no delegable de v0.2.x.

## Peticiones a otras zonas
- (PROPIETARIO) la decisión de licencia sigue pendiente + recordatorio: ROTAR el token ghp_ del chat (usado de nuevo en URLs de push de un solo uso, no persistido).
- (IMP-2) tu alerta del lab-runtime quedó como observación valiosa, no como error — DIR no la reproduce en main (514/514 ×1 completo); si vuelves a verla, documenta el repro exacto (orden de ficheros, DATABASE_URL) y TEST la investiga; tu cita 10/10 con SMOKE_SKIP_UNIT es correcta.
- (IMP-1) H-006 CERRADO — las tres capas exactamente como prometiste en el claim; el 400/503 antes del create es el mismo molde H-004/H-002: tres cierres con el mismo patrón. ranking-elo en cola.
- (TEST) ci-basico en tus manos: recuerda las notas de la 13ª (build fresco obligatorio, standalone stale) y que SMOKE_SKIP_UNIT existe si la fase 0 te estorba en iteración local; si algún día reproduces los 18 fallos que alertó IMP-2, el orden de ficheros/aislamiento del singleton es la pista.
- (PUL) el badge ya está al día (DIR lo arregló en la 15ª con la justificación documentada en el ROADMAP) — al retomar, revisa esa ejecución cross-zone; cola residual: caddy-validate-ci/gitleaks-ci/script-typecheck (autorizaciones de la 12ª vigentes).

## Métricas (semana del 2026-10-23)
- Tareas cerradas desde la migración: 68 [x] / 136 abiertas. Por zona: SEG 22 · IMP 23 (IMP-2 14, IMP-1 9) · TEST 12 · DIR 6 · PUL 5.
- Suite unitaria: 514/514 (14 920 expect, 30 ficheros) · canon VERDE (15 casos · 42 comprobaciones, sobre standalone reconstruido post-fusión) · e2e 11 suites (reinicio-servidor re-verificada 19/19 hoy).
- Hallazgos: H-001, H-002, H-004, H-005 y H-006 resueltos-verificados (5 ciclos completos) · H-003 abierto (espera datos de balance-drift, D30).
- Desviaciones: 19/19 ratificadas. Correcciones de cita: 8 acumuladas (7 IMP-2 + 1 IMP-1); en la 15ª, 0 — la cita de IMP-2 se verificó y era correcta.
- Prioridad de personas (permanente cobertura-personas): #1 usuario torpe SIN pendientes · #2 administrador/operador SIN pendientes (H-002 + H-006 cerrados) · #3 móvil/accesibilidad desbloqueada cuando ci-basico aterrice.

## Notas de proceso
- La ronda que abre en vigilancia puede cerrar en verificación: la puerta de DIR (lint+suite+canon) se ejecuta ANTES de mirar el remoto, y el remoto cambia debajo — el patrón ampliación-en-vivo (rebase + verificación sobre el árbol fusionado) ya es rutina. PRIMERA DISPUTA ENTRE AGENTES adjudicada con ejecución propia (no con opiniones): la cifra que DIR corre zanja. Token solo en URL de push de un solo uso; nunca persistido. worklog.md sigue retirado (14ª): el historial lo guarda git.
