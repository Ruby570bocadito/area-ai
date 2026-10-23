# claim: toasts-coherentes

- ID: IMP-2
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: src/hooks/use-toast.ts, src/hooks/use-arena-state.tsx, src/components/arena/model-studio.tsx, src/components/arena/history-panel.tsx, docs/agentes/estado/IMP-2.md, docs/agentes/ROADMAP.md (solo tick de esta tarea)
- Detalle: política única de avisos documentada en use-toast.ts — duraciones por tipo (AVISO_MS 6 s para confirmaciones, ERROR_MS 9 s para errores, RESULTADO_MS 12 s para el fin de campaña con acción; hoy los toasts sin `duration` explícito NUNCA se cierran solos) con respeto al `duration` explícito del llamador; puerta única `toastError(título, detalle)` para todos los destructivos (variante + duración + detalle legible: string literal, `Error.message` o texto estándar de red); copys unificados — errores «No se pudo …» (antes «Error al descargar modelos», «Error al guardar»), acciones con altText «Abrir …» ya coherente; caso «exportación lista»: toast explicativo cuando el portapapeles está bloqueado y el informe agregado se descarga como archivo (ruta de degradación honesta del botón Copiar del historial).
