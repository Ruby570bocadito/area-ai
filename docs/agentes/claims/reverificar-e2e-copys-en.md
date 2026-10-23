# claim: reverificar-e2e-copys-en

- agente: TEST
- fecha: 2026-10-23T13:30:00Z
- zona: tests/e2e/*.e2e.mjs (solo historial-filtros y volumen)
- tarea: re-verificar y actualizar las aserciones de copys de UI de las suites
  e2e tras el aterrizaje de la orden del propietario (inglés en UI, IMP-2 5feb1d4).
  Historial-filtros y volumen asertan etiquetas del HistoryPanel vía
  react-dom/server («Gana RED», «En curso», contador «X de Y», cabecera
  «Historial de campañas») — IMP-2 dejó el aviso pactado en su release
  (dacd589) y en su estado («no toqué tests/»). Ajuste de aserciones al nuevo
  copy EN + re-ejecución completa de ambas suites contra standalone de main.
  Las otras 7 suites son de nivel API (sin aserciones de texto de UI) —
  verificado con barrido rg sobre las 9.
- abre: 2026-10-23
