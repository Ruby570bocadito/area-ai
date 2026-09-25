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

function asZaiClient(instance: unknown): ZaiClient {
  return instance as ZaiClient
}

async function getZai(): Promise<ZaiClient> {
  if (!zaiPromise) {
    zaiPromise = (async () => {
      const mod = await import('z-ai-web-dev-sdk')
      const ZAI = mod.default
      return asZaiClient(await ZAI.create())
    })()
    // si la creación falla, no cachear el rechazo: permitir reintento
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
  const res = await withTimeout(
    fetch(`${cfg.baseUrl}/chat/completions`, {
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
    }),
    timeoutMs
  )
  if (!res.ok) return null
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? null
}

async function callZai(system: string, user: string, timeoutMs: number): Promise<string | null> {
  try {
    const zai = await getZai()
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
