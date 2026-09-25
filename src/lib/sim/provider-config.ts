// ─────────────────────────────────────────────────────────────
// Configuración de proveedor LLM persistida en BD (tabla Setting)
//
// Prioridad de lectura:
//   1. BD (configurada desde el Model Studio de la UI)
//   2. Variables de entorno (OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL)
//   3. z-ai-web-dev-sdk integrado
//
// Cache en memoria con invalidación explícita al guardar.
// SOLO servidor.
// ─────────────────────────────────────────────────────────────

export interface ProviderConfig {
  /** Base URL compatible OpenAI, ej: https://api.deepseek.com/v1 */
  baseUrl: string
  /** API key en claro (solo servidor) */
  apiKey: string
  /** Identificador del modelo, ej: deepseek-chat */
  model: string
  /** De dónde salió la config: db | env | zai */
  source: 'db' | 'env' | 'zai'
}

const KEYS = {
  baseUrl: 'llm.base_url',
  apiKey: 'llm.api_key',
  model: 'llm.model',
} as const

let cache: ProviderConfig | null = null
let cacheAt = 0
const CACHE_TTL = 5_000

export function invalidateProviderCache() {
  cache = null
  cacheAt = 0
}

async function dbGet(key: string): Promise<string | null> {
  try {
    const { db } = await import('@/lib/db')
    const row = await db.setting.findUnique({ where: { key } })
    return row?.value ?? null
  } catch {
    return null
  }
}

async function dbSet(key: string, value: string) {
  const { db } = await import('@/lib/db')
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/** Config efectiva (BD → env → z-ai). Nunca lanza. */
export async function getProviderConfig(): Promise<ProviderConfig> {
  const now = Date.now()
  if (cache && now - cacheAt < CACHE_TTL) return cache

  let cfg: ProviderConfig

  const [kBaseUrl, kApiKey, kModel] = await Promise.all([
    dbGet(KEYS.baseUrl),
    dbGet(KEYS.apiKey),
    dbGet(KEYS.model),
  ])

  if (kBaseUrl && kApiKey && kModel) {
    cfg = { baseUrl: kBaseUrl, apiKey: kApiKey, model: kModel, source: 'db' }
  } else if (process.env.OPENAI_API_KEY) {
    cfg = {
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      source: 'env',
    }
  } else {
    cfg = { baseUrl: '', apiKey: '', model: 'z-ai-sdk', source: 'zai' }
  }

  cache = cfg
  cacheAt = now
  return cfg
}

export async function saveProviderConfig(input: {
  baseUrl: string
  apiKey?: string // si viene vacío se conserva la actual
  model: string
}): Promise<ProviderConfig> {
  await dbSet(KEYS.baseUrl, input.baseUrl.replace(/\/$/, ''))
  if (input.apiKey && input.apiKey.trim().length > 0) {
    await dbSet(KEYS.apiKey, input.apiKey.trim())
  }
  await dbSet(KEYS.model, input.model)
  invalidateProviderCache()
  return getProviderConfig()
}

/** Llave enmascarada para mostrar en UI */
export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`
}
