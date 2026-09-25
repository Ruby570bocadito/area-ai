'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  SlidersHorizontal,
  CircleAlert,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// MODEL STUDIO — Configuración profesional del proveedor LLM
// Presets de proveedores + descarga del catálogo de modelos
// (GET /v1/models) + selección y guardado persistente.
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

export function ModelStudio({ onSaved }: { onSaved?: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

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
    if (open) void loadSettings()
  }, [open, loadSettings])

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
        title: `⬇️ ${data.count ?? 0} modelos descargados`,
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
        title: '✅ Motor actualizado',
        description: `Los agentes usarán ${model.trim()} en la próxima campaña.`,
      })
      setApiKey('')
      await loadSettings()
      onSaved?.()
      setOpen(false)
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
    db: { label: 'Personalizado', cls: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
    env: { label: 'Variables de entorno', cls: 'border-amber-500/50 bg-amber-500/10 text-amber-300', icon: <KeyRound className="h-3 w-3" /> },
    zai: { label: 'Motor integrado z-ai', cls: 'border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#67e8f9]', icon: <Cpu className="h-3 w-3" /> },
  }[settings?.source ?? 'zai']

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Abrir Model Studio"
          className="shrink-0 gap-2 border-[#1c2b4a] bg-black/40 px-2.5 font-mono-tight text-[11px] hover:border-[#22d3ee]/50 hover:bg-black/60 sm:px-3"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#22d3ee]" />
          <span className="hidden sm:inline">Model Studio</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="glass-strong nice-scroll max-h-[85vh] max-w-xl overflow-y-auto border-[#1c2b4a] p-0">
        <DialogHeader className="border-b border-[#131f38] px-6 py-5">
          <DialogTitle className="font-display flex items-center gap-2.5 text-lg font-bold uppercase tracking-wider">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10">
              <Cpu className="h-4.5 w-4.5 text-[#22d3ee]" />
            </span>
            Model Studio
          </DialogTitle>
          <DialogDescription className="font-grotesk text-xs leading-relaxed">
            Conecta tu proveedor LLM compatible OpenAI, descarga el catálogo de modelos y elige el
            cerebro de los agentes. La configuración se guarda en la base de datos de la arena.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {/* Estado actual */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1c2b4a] bg-black/30 px-3.5 py-2.5">
            <span className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tight text-[10px] font-bold uppercase tracking-wider', sourceBadge.cls)}>
              {sourceBadge.icon}
              {sourceBadge.label}
            </span>
            <span className="font-mono-tight text-[11px] text-muted-foreground">
              {settings?.model ? (
                <>
                  modelo: <span className="text-foreground">{settings.model}</span>
                  {settings.hasApiKey && <span className="ml-2 text-[10px]">🔑 {settings.apiKeyMasked}</span>}
                </>
              ) : (
                'motor por defecto sin API key'
              )}
            </span>
          </div>

          {/* Presets */}
          <div>
            <Label className="font-grotesk text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                      ? 'border-[#22d3ee]/60 bg-[#22d3ee]/10 text-[#67e8f9] glow-cyan'
                      : 'border-[#1c2b4a] bg-black/30 text-muted-foreground hover:border-[#22d3ee]/40 hover:text-foreground'
                  )}
                >
                  <span className="text-base">{p.icon}</span>
                  {p.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* URL + API key */}
          <div className="grid gap-3">
            <div>
              <Label htmlFor="ms-url" className="font-grotesk flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                className="mt-1.5 border-[#1c2b4a] bg-black/40 font-mono-tight text-xs"
              />
            </div>
            <div>
              <Label htmlFor="ms-key" className="font-grotesk flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <KeyRound className="h-3 w-3" /> 3 · API key {settings?.hasApiKey && <span className="normal-case text-[10px] text-muted-foreground">(dejar vacío para conservar {settings.apiKeyMasked})</span>}
              </Label>
              <Input
                id="ms-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                className="mt-1.5 border-[#1c2b4a] bg-black/40 font-mono-tight text-xs"
              />
            </div>
          </div>

          {/* Descargar modelos */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="font-grotesk text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                4 · Catálogo de modelos
              </Label>
              <Button
                type="button"
                size="sm"
                onClick={() => void fetchModels()}
                disabled={fetching || !baseUrl.trim()}
                className="h-8 gap-1.5 bg-gradient-to-r from-[#22d3ee] to-[#3b82f6] font-mono-tight text-[11px] font-bold text-black hover:opacity-90"
              >
                {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Descargar modelos
              </Button>
            </div>

            {models.length > 0 && (
              <>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filtrar modelos…"
                    className="h-8 border-[#1c2b4a] bg-black/40 pl-8 font-mono-tight text-xs"
                  />
                </div>
                <ScrollArea className="mt-2 h-44 rounded-lg border border-[#1c2b4a] bg-black/40">
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
                          'flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-left transition-colors last:border-0',
                          model === m.id ? 'bg-[#22d3ee]/10' : 'hover:bg-white/5'
                        )}
                      >
                        <span className={cn('font-mono-tight text-[11px]', model === m.id ? 'text-[#67e8f9]' : 'text-foreground/85')}>
                          {m.id}
                        </span>
                        {model === m.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#22d3ee]" />
                        ) : (
                          <span className="shrink-0 font-mono-tight text-[9px] uppercase tracking-wider text-muted-foreground/60">
                            {m.owner}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {filtered.length === 0 && (
                    <p className="px-3 py-6 text-center font-grotesk text-[11px] text-muted-foreground">
                      Sin resultados para «{query}»
                    </p>
                  )}
                </ScrollArea>
              </>
            )}
            {models.length === 0 && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-[#1c2b4a] bg-black/20 px-3 py-2.5 font-grotesk text-[11px] text-muted-foreground">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                Pulsa «Descargar modelos» para sincronizar el catálogo del proveedor.
              </p>
            )}
          </div>

          {/* Modelo manual */}
          <div>
            <Label htmlFor="ms-model" className="font-grotesk text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              5 · Modelo seleccionado
            </Label>
            <Input
              id="ms-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat · gpt-4o-mini · llama-3.3-70b-versatile…"
              className="mt-1.5 border-[#1c2b4a] bg-black/40 font-mono-tight text-xs"
            />
          </div>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-full gap-2 bg-gradient-to-r from-[#ff3355] via-[#a755ff] to-[#22d3ee] font-mono-tight text-xs font-bold uppercase tracking-widest text-white hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Guardar y activar motor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
