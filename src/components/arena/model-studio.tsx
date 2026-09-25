'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { SiDeepseek, SiOllama, SiHuggingface } from 'react-icons/si'
import { FaRobot, FaRocket, FaFire } from 'react-icons/fa6'
import {
  Download,
  Search,
  CheckCircle2,
  Cpu,
  KeyRound,
  Link2,
  Loader2,
  CircleAlert,
  Zap,
  ShieldCheck,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// MODEL STUDIO — panel de página: configuración profesional del
// proveedor LLM (presets + descarga real del catálogo /v1/models
// + selección + guardado persistente en la base de datos).
// ─────────────────────────────────────────────────────────────

interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  hint: string
  icon: React.ReactNode
}

const PRESETS: ProviderPreset[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', hint: 'gpt-4o · gpt-4o-mini · o3-mini', icon: <FaRobot className="h-4 w-4" /> },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', hint: 'deepseek-chat · deepseek-reasoner', icon: <SiDeepseek className="h-4 w-4" /> },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', hint: 'llama-3.3-70b · mixtral', icon: <Zap className="h-4 w-4" /> },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', hint: '+300 modelos unificados', icon: <FaRocket className="h-4 w-4" /> },
  { id: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', hint: 'llama · qwen · mistral', icon: <SiHuggingface className="h-4 w-4" /> },
  { id: 'fireworks', label: 'Fireworks', baseUrl: 'https://api.fireworks.ai/inference/v1', hint: 'modelos open-source rápidos', icon: <FaFire className="h-4 w-4" /> },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', hint: 'modelos locales sin coste', icon: <SiOllama className="h-4 w-4" /> },
]

interface ModelInfo {
  id: string
  owner: string
}

interface SettingsInfo {
  source: 'db' | 'env' | 'zai'
  baseUrl: string
  model: string
  apiKeyMasked: string
  hasApiKey: boolean
}

export function ModelStudioPanel({ onSaved }: { onSaved?: () => void }) {
  const { toast } = useToast()

  const [settings, setSettings] = useState<SettingsInfo | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [query, setQuery] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' })
      const data = (await res.json()) as { ok: boolean } & SettingsInfo
      if (data.ok) {
        setSettings(data)
        setBaseUrl(data.baseUrl)
        setModel(data.source === 'zai' ? '' : data.model)
        setModels((prev) => (prev.length ? prev : data.model ? [{ id: data.model, owner: 'actual' }] : []))
      }
    } catch {
      /* silencio */
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const applyPreset = (p: ProviderPreset) => {
    setActivePreset(p.id)
    setBaseUrl(p.baseUrl)
  }

  const fetchModels = async () => {
    if (!baseUrl.trim()) {
      toast({ title: 'Falta la Base URL', description: 'Elige un proveedor o escribe la URL compatible OpenAI.', variant: 'destructive' })
      return
    }
    setFetching(true)
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined }),
      })
      const data = (await res.json()) as { ok: boolean; models?: ModelInfo[]; count?: number; error?: string }
      if (!data.ok) throw new Error(data.error || 'No se pudo descargar el catálogo')
      setModels(data.models ?? [])
      setActivePreset((cur) => {
        const match = PRESETS.find((p) => p.baseUrl.replace(/\/$/, '') === baseUrl.replace(/\/$/, ''))
        return match ? match.id : cur
      })
      toast({
        title: `${data.count ?? 0} modelos descargados`,
        description: 'Catálogo sincronizado con el proveedor. Selecciona un modelo.',
      })
    } catch (e) {
      toast({
        title: 'Error al descargar modelos',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setFetching(false)
    }
  }

  const save = async () => {
    if (!baseUrl.trim() || !model.trim() || !(apiKey.trim() || settings?.hasApiKey)) {
      toast({
        title: 'Configuración incompleta',
        description: 'Se necesitan Base URL, API key y un modelo seleccionado.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined, model: model.trim() }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) throw new Error(data.error || 'No se pudo guardar')
      toast({
        title: 'Motor actualizado',
        description: `Los agentes usarán ${model.trim()} en la próxima campaña.`,
      })
      setApiKey('')
      await loadSettings()
      onSaved?.()
    } catch (e) {
      toast({
        title: 'Error al guardar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) => m.id.toLowerCase().includes(q) || m.owner.toLowerCase().includes(q))
  }, [models, query])

  const sourceBadge = {
    db: { label: 'Personalizado', cls: 'border-[#a6f4c5] bg-[#ecfdf3] text-[#067647]', icon: <CheckCircle2 className="h-3 w-3" /> },
    env: { label: 'Variables de entorno', cls: 'status-live', icon: <KeyRound className="h-3 w-3" /> },
    zai: { label: 'Motor integrado z-ai', cls: 'border-[#b2ddff] bg-[#f0f9ff] text-[#026aa2]', icon: <Cpu className="h-3 w-3" /> },
  }[settings?.source ?? 'zai']

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
      {/* Configuración */}
      <div className="panel rounded-2xl p-5 sm:p-6">
        {/* Estado actual */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4e7ec] bg-[#f9fafb] px-3.5 py-2.5">
          <span className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tight text-[10px] font-bold uppercase tracking-wider', sourceBadge.cls)}>
            {sourceBadge.icon}
            {sourceBadge.label}
          </span>
          <span className="font-mono-tight text-[11px] text-ink-500">
            {settings?.model ? (
              <>
                modelo: <span className="text-ink-900">{settings.model}</span>
                {settings.hasApiKey && <span className="ml-2 text-[10px]">🔑 {settings.apiKeyMasked}</span>}
              </>
            ) : (
              'motor por defecto sin API key'
            )}
          </span>
        </div>

        {/* Presets */}
        <div className="mt-5">
          <Label className="font-mono-tight text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            1 · Proveedor
          </Label>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {PRESETS.map((p) => (
              <motion.button
                key={p.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => applyPreset(p)}
                title={p.hint}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[10px] font-semibold transition-colors',
                  activePreset === p.id
                    ? 'border-ink-900 bg-[#f9fafb] text-ink-900 shadow-sm'
                    : 'border-[#e4e7ec] bg-white text-ink-500 hover:border-[#d0d5dd] hover:text-ink-900'
                )}
              >
                <span className="text-base">{p.icon}</span>
                {p.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* URL + API key */}
        <div className="mt-5 grid gap-3">
          <div>
            <Label htmlFor="ms-url" className="font-mono-tight flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              <Link2 className="h-3 w-3" /> 2 · Base URL (compatible OpenAI)
            </Label>
            <Input
              id="ms-url"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                setActivePreset(null)
              }}
              placeholder="https://api.deepseek.com/v1"
              className="mt-1.5 border-[#d0d5dd] bg-white font-mono-tight text-xs"
            />
          </div>
          <div>
            <Label htmlFor="ms-key" className="font-mono-tight flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              <KeyRound className="h-3 w-3" /> 3 · API key {settings?.hasApiKey && <span className="normal-case tracking-normal text-[10px] font-normal text-ink-500">(dejar vacío para conservar {settings.apiKeyMasked})</span>}
            </Label>
            <Input
              id="ms-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className="mt-1.5 border-[#d0d5dd] bg-white font-mono-tight text-xs"
            />
          </div>
        </div>

        {/* Descargar modelos */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2">
            <Label className="font-mono-tight text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              4 · Catálogo de modelos
            </Label>
            <Button
              type="button"
              size="sm"
              onClick={() => void fetchModels()}
              disabled={fetching || !baseUrl.trim()}
              className="h-8 gap-1.5 bg-ink-900 font-mono-tight text-[11px] font-bold text-white hover:bg-[#182230]"
            >
              {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Descargar modelos
            </Button>
          </div>

          {models.length > 0 && (
            <>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar modelos…"
                  className="h-8 border-[#d0d5dd] bg-white pl-8 font-mono-tight text-xs"
                />
              </div>
              <ScrollArea className="mt-2 h-44 rounded-lg border border-[#e4e7ec] bg-white">
                <AnimatePresence initial={false}>
                  {filtered.map((m) => (
                    <motion.button
                      key={m.id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setModel(m.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 border-b border-[#f2f4f7] px-3 py-2 text-left transition-colors last:border-0',
                        model === m.id ? 'bg-[#f0f9ff]' : 'hover:bg-[#f9fafb]'
                      )}
                    >
                      <span className={cn('font-mono-tight text-[11px]', model === m.id ? 'font-semibold text-[#026aa2]' : 'text-[#344054]')}>
                        {m.id}
                      </span>
                      {model === m.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#026aa2]" />
                      ) : (
                        <span className="shrink-0 font-mono-tight text-[9px] uppercase tracking-wider text-ink-400">
                          {m.owner}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-[11px] text-ink-500">
                    Sin resultados para «{query}»
                  </p>
                )}
              </ScrollArea>
            </>
          )}
          {models.length === 0 && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-[#d0d5dd] bg-[#f9fafb] px-3 py-2.5 text-[11px] text-ink-500">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              Pulsa «Descargar modelos» para sincronizar el catálogo del proveedor.
            </p>
          )}
        </div>

        {/* Modelo manual */}
        <div className="mt-5">
          <Label htmlFor="ms-model" className="font-mono-tight text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            5 · Modelo seleccionado
          </Label>
          <Input
            id="ms-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat · gpt-4o-mini · llama-3.3-70b-versatile…"
            className="mt-1.5 border-[#d0d5dd] bg-white font-mono-tight text-xs"
          />
        </div>

        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-5 w-full gap-2 bg-ink-900 font-mono-tight text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-[#182230]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Guardar y activar motor
        </Button>
      </div>

      {/* Lateral informativo */}
      <div className="space-y-4">
        <div className="panel rounded-2xl p-4.5">
          <p className="flex items-center gap-2 font-mono-tight text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
            <Info className="h-3.5 w-3.5" /> Qué hace esta configuración
          </p>
          <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-[#475467]">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
              Cada acción de los agentes (tácticas, narrativa, lecciones archivadas) la decide el modelo activo.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
              La API key se guarda en la base de datos local del laboratorio y nunca se muestra en claro.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
              Sin configuración externa, el motor usa el proveedor integrado z-ai.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
              El cambio es inmediato: la próxima campaña que se lance usará el modelo activado.
            </li>
          </ul>
        </div>

        <div className="panel rounded-2xl p-4.5">
          <p className="flex items-center gap-2 font-mono-tight text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Estado del motor
          </p>
          <div className="mt-3 space-y-2 font-mono-tight text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Fuente</span>
              <span className="font-semibold text-ink-900">{sourceBadge.label}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-500">Base URL</span>
              <span className="truncate text-ink-900">{settings?.baseUrl || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-500">Modelo</span>
              <span className="truncate text-ink-900">{settings?.model || 'z-ai-sdk'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">API key</span>
              <span className="text-ink-900">{settings?.hasApiKey ? settings.apiKeyMasked : 'no configurada'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
