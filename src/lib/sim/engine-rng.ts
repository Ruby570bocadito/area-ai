// ─────────────────────────────────────────────────────────────
// engine-rng — RNG sembrable y semillas por campaña.
//
// Extraído de engine.ts (refactor-engine-fases) sin cambiar
// comportamiento. Contrato fijado en tests/engine.test.ts y
// tests/seed-determinista.test.ts.
//
// Sin semilla el motor se comporta exactamente igual que antes
// (Math.random). Con setEngineSeed(n) todas las tiradas del
// motor (elección de escenario/nodo, momentum RED, turno
// proactivo de BLUE) pasan por un PRNG determinista: base de
// campañas reproducibles (seed-determinista) y de la red de
// seguridad de tests.
// ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let rng: () => number = Math.random

/** Fija la semilla del motor (sin argumento restaura Math.random). Para tests y campañas reproducibles. */
export function setEngineSeed(seed?: number): void {
  rng = seed === undefined ? Math.random : mulberry32(seed)
}

/** Tirada aleatoria del motor (sembrable con setEngineSeed). Consumo interno del orquestador y de los módulos del motor. */
export function engineRoll(): number {
  return rng()
}

/**
 * Sonda del RNG interno (seed-determinista): devuelve la tirada cruda
 * para fijar en tests el contrato de reproducibilidad (misma semilla →
 * misma secuencia). El flujo de producción no la consume.
 */
export function engineRollProbe(): number {
  return rng()
}

/** Elección uniforme sobre una lista con el RNG del motor. */
export const rand = <T,>(arr: T[]): T => arr[Math.floor(engineRoll() * arr.length)]

// ── Semilla por campaña (seed-determinista) ────────────────

/** Tope de la semilla: entero positivo de 31 bits (rango seguro para SQLite e Int32). */
export const SEED_MAX = 0x7fffffff

/**
 * Genera la semilla de una campaña nueva. Inyectable para tests;
 * por defecto Math.random (NUNCA engineRoll: la semilla generada
 * con el RNG ya sembrado correlacionaría las campañas entre sí).
 */
export function newCampaignSeed(rand: () => number = Math.random): number {
  return Math.floor(rand() * SEED_MAX)
}

/**
 * Valida una semilla provista por el cliente (POST /api/campaigns).
 * Acepta enteros en [0, SEED_MAX]; devuelve null si no es usable —
 * el llamador responde 400 (validación de entradas, H-004) en vez
 * de silenciar la intención del usuario.
 */
export function acceptSeed(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 0 || value > SEED_MAX) return null
  return value
}

/**
 * Valida el interruptor determinista provisto por el cliente
 * (POST /api/campaigns). Solo booleanos; otro tipo → null y la ruta
 * responde 400 (mismo criterio que acceptSeed: no se silencia).
 */
export function acceptDeterminista(value: unknown): boolean | null {
  if (typeof value !== 'boolean') return null
  return value
}

/**
 * Valida el interruptor de dificultad adaptativa provisto por el
 * cliente (POST /api/campaigns, dificultad-adaptativa). Solo
 * booleanos; otro tipo → null y la ruta responde 400 (mismo
 * criterio que acceptDeterminista: no se silencia la intención).
 */
export function acceptAdaptativa(value: unknown): boolean | null {
  if (typeof value !== 'boolean') return null
  return value
}
