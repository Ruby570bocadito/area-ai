// ─────────────────────────────────────────────────────────────
// Cerrojo de lanzamiento — serializa el arranque de campañas.
//
// Tarea ROADMAP idempotencia-lanzamiento ([S], [verificar] confirmado
// con 6 POST concurrentes → 2 campañas RUNNING simultáneas): el
// arranque era check-then-act — `findFirst({ status: 'RUNNING' })`
// y después `create()` — y dos peticiones que se cruzaban entre
// ambas esperas creaban cada una su campaña (carrera TOCTOU).
// El cerrojo del cliente (confirmacion-lanzamiento) nunca cubría
// curl/scripts; este cierra el servidor.
//
// Módulo puro (sin BD, sin HTTP): una cadena de promesas — cada
// sección crítica entra cuando la anterior termina, correcta o
// con error; la cola nunca rechaza. En un proceso único (el motor
// corre in-process) esto hace atómico check+create: el segundo
// lanzamiento concurrente ya ve la RUNNING y termina en 409.
// ─────────────────────────────────────────────────────────────

export type LaunchGate = <T>(task: () => Promise<T>) => Promise<T>

/**
 * Crea un gate que ejecuta las tareas ENVIADAS en serie, aunque
 * llegen concurrentes. Cada tarea recibe al anterior (éxito o
 * fallo) como predecessor; el error de una tarea NO contamina a
 * las siguientes (la cola sigue) pero SÍ se propaga a su llamador.
 */
export function createLaunchGate(): LaunchGate {
  let tail: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    // El predecessor se consuma con .then(task, task): si el anterior
    // falló, esta tarea corre igualmente (su error es cosa suya).
    const run = tail.then(task, task) as Promise<T>
    // La cola retiene una promesa NUNCA rechazante; sin esto, un
    // rechazo sin observador colgaría el proceso (unhandled rejection).
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
