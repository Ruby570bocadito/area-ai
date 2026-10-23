// ─────────────────────────────────────────────────────────────
// Wrapper LLM multi-proveedor para el motor de simulación
//
// Orden de proveedores:
//   1. OPENAI_API_KEY (+ opcional OPENAI_BASE_URL / OPENAI_MODEL)
//      → cualquier proveedor compatible OpenAI (OpenAI, Groq,
//        DeepSeek, Together, Ollama local, OpenRouter…)
//   2. z-ai-web-dev-sdk (integrado, sin API key)
//
// Devuelve null si todos fallan → el motor usa modo determinista.
// SOLO para uso en servidor (API routes / lib backend).
// ─────────────────────────────────────────────────────────────

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Cliente mínimo que usa el motor del SDK z-ai (tipado estructural;
// el SDK real no exporta un tipo compatible estable entre versiones)
interface ZaiClient {
  chat: {
    completions: {
      create: (opts: unknown) => Promise<{ choices: Array<{ message?: { content?: string } }> }>
    }
  }
}

let zaiPromise: Promise<ZaiClient> | null = null

// Techo del plazo de creación del SDK: ZAI.create() no tiene timeout propio
// y, si colgara (DNS/red degradada), callZai quedaría colgado aunque sus
// llamadas posteriores sí lo tengan. La creación se acota por el plazo de
// la llamada en curso con este máximo (10 s); el rechazo no se cachea
// (ver getZai), de modo que el reintento posterior vuelve a intentar
// crear y el motor degrada a modo determinista si no hay remedio.
const CREATION_TIMEOUT_CAP_MS = 10_000

function asZaiClient(instance: unknown): ZaiClient {
  return instance as ZaiClient
}

async function getZai(timeoutMs: number): Promise<ZaiClient> {
  if (!zaiPromise) {
    zaiPromise = (async () => {
      const mod = await import('z-ai-web-dev-sdk')
      const ZAI = mod.default
      return asZaiClient(await ZAI.create())
    })()
    // la creación también respeta un plazo: si cuelga, rechaza
    zaiPromise = withTimeout(zaiPromise, Math.min(timeoutMs, CREATION_TIMEOUT_CAP_MS))
    // si la creación falla o supera el plazo, no cachear el rechazo: permitir reintento
    void zaiPromise.catch(() => {
      zaiPromise = null
    })
  }
  return zaiPromise
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), ms)),
  ])
}

function extractJson(raw: string): unknown | null {
  if (!raw) return null
  let text = raw.trim()
  // quitar razonamiento envuelto en <think>…</think>
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // quitar fences ```json … ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  // recortar al primer { o [ balanceado
  const start = text.search(/[{[]/)
  if (start === -1) return null
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  const end = text.lastIndexOf(close)
  if (end > start) text = text.slice(start, end + 1)
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function callOpenAICompatible(
  system: string,
  user: string,
  timeoutMs: number
): Promise<string | null> {
  const { getProviderConfig } = await import('./provider-config')
  const cfg = await getProviderConfig()
  if (cfg.source === 'zai' || !cfg.apiKey) return null

  // ── Defensa en profundidad SSRF (protocolo §6) ── La baseUrl pudo guardarse
  // en BD antes de que existiera el guard de /api/settings (o venir de env).
  // El punto de CUMPLIMIENTO es safeFetch (tarea ssrf-ip-pinning): resuelve UNA
  // vez, clasifica ese mismo lote (metadata SIEMPRE bloqueada, incluida vía
  // DNS; privados permitidos — caso legítimo: Ollama en localhost —) y conecta
  // a la IP fijada con Host/SNI originales; el fetch histórico re-resolvía DNS
  // y un rebinding podía colar otra IP en la conexión.

  // Sin try/catch global, un fallo de red del proveedor (ECONNREFUSED, DNS,
  // TLS o timeout del AbortSignal) subiría por llmText → llmJson → motor y
  // ABORTARÍA la campaña entera; el contrato de esta función es devolver
  // null y que el motor degrade a modo determinista (igual que callZai).
  try {
    const { safeFetch } = await import('@/lib/net/safe-fetch')
    const res = await withTimeout(
      safeFetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.8,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        timeoutMs,
        allowedKinds: ['private', 'public'],
      }),
      timeoutMs
    )
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? null
  } catch (e) {
    // Sin instanceof (el módulo se importa dinámicamente dentro del try):
    // el nombre y el código del error bastan y no acoplan este fichero
    if (e instanceof Error && e.name === 'SafeFetchError' && (e as { code?: string }).code === 'metadata-blocked') {
      console.error('[llm] baseUrl del proveedor apunta a metadata de nube — petición bloqueada')
    }
    return null
  }
}

async function callZai(system: string, user: string, timeoutMs: number): Promise<string | null> {
  try {
    const zai = await getZai(timeoutMs)
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: system },
          { role: 'user', content: user },
        ],
        thinking: { type: 'disabled' },
      }),
      timeoutMs
    )
    return completion.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

/** Llamada cruda que devuelve texto del modelo o null */
export async function llmText(system: string, user: string, timeoutMs = 30000): Promise<string | null> {
  // intento 1: proveedor externo si está configurado (BD o env)
  const { getProviderConfig } = await import('./provider-config')
  const cfg = await getProviderConfig()
  if (cfg.source !== 'zai' && cfg.apiKey) {
    const out = await callOpenAICompatible(system, user, timeoutMs)
    if (out && out.trim().length > 0) return out
  }
  // intento 2: z-ai sdk (2 reintentos)
  for (let i = 0; i < 2; i++) {
    const out = await callZai(system, user, timeoutMs)
    if (out && out.trim().length > 0) return out
  }
  return null
}

/** Llamada que exige JSON estricto; null si no se consigue */
export async function llmJson<T>(system: string, user: string, timeoutMs = 30000): Promise<T | null> {
  const sys = `${system}\n\nIMPORTANTE: responde ÚNICAMENTE con JSON válido, sin explicaciones, sin markdown, sin texto adicional.`
  for (let i = 0; i < 2; i++) {
    const raw = await llmText(sys, user, timeoutMs)
    if (raw) {
      const parsed = extractJson(raw)
      if (parsed !== null) return parsed as T
    }
  }
  return null
}

export async function llmProviderName(): Promise<string> {
  const { getProviderConfig } = await import('./provider-config')
  const cfg = await getProviderConfig()
  if (cfg.source === 'zai') return 'z-ai-sdk'
  return cfg.model || 'openai-compatible'
}
