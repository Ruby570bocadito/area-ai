'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Loader2, RadioTower, Building2, Cpu, ShieldAlert, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioDTO } from '@/lib/api-types'

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Dificultad ${level} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < level ? 'bg-gradient-to-r from-amber-400 to-[#ff3355]' : 'bg-white/10'
          )}
        />
      ))}
    </span>
  )
}

export function ControlCenter({
  scenarios,
  running,
  provider,
  disabled,
  onStart,
}: {
  scenarios: ScenarioDTO[]
  running: boolean
  provider: string
  disabled: boolean
  onStart: (scenarioId?: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    if (disabled || starting) return
    setStarting(true)
    try {
      await onStart(selected ?? undefined)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="scan-beam" />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#22d3ee]/40 bg-[#22d3ee]/10">
            <RadioTower className="h-5 w-5 text-[#22d3ee]" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-wide">CENTRO DE CONTROL</h2>
            <p className="text-xs text-muted-foreground">
              Elige un escenario de infraestructura y lanza una campaña Red vs Blue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[#1c2b4a] bg-black/40 px-3 py-1.5 font-mono-tight text-[10px] text-muted-foreground">
            <Cpu className="h-3 w-3 text-[#22d3ee]" />
            Motor LLM: {provider}
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono-tight text-[10px]',
              running
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full anim-blink', running ? 'bg-amber-400' : 'bg-emerald-400')} />
            {running ? 'CAMPAÑA EN CURSO' : 'SISTEMA LISTO'}
          </span>
        </div>
      </div>

      {/* Selector de escenarios */}
      <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s, i) => {
          const isSel = selected === s.id
          return (
            <motion.button
              key={s.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setSelected(isSel ? null : s.id)}
              disabled={running}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-3.5 text-left transition-all disabled:opacity-50',
                isSel
                  ? 'border-run glow-cyan'
                  : 'border-[#1c2b4a] bg-black/30 hover:border-[#22d3ee]/40 hover:bg-black/50'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-tight text-[11px] font-bold tracking-widest text-[#67e8f9]">
                  {s.codename}
                </span>
                <DifficultyDots level={s.difficulty} />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {s.company}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.industry}</p>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">{s.description}</p>
              {isSel && (
                <motion.span
                  layoutId="sel-check"
                  className="absolute bottom-2.5 right-2.5 rounded-full bg-[#22d3ee]/20 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#67e8f9]"
                >
                  SELECCIONADO
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Botón de inicio */}
      <div className="relative z-10 mt-5 flex flex-col items-center gap-2">
        <motion.button
          type="button"
          whileHover={{ scale: disabled ? 1 : 1.03 }}
          whileTap={{ scale: disabled ? 1 : 0.97 }}
          onClick={handleStart}
          disabled={disabled || starting}
          className={cn(
            'relative flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-bold uppercase tracking-widest transition-opacity',
            'bg-gradient-to-r from-[#ff3355] via-[#a755ff] to-[#22d3ee] text-white shadow-[0_0_30px_rgba(167,85,255,0.35)]',
            (disabled || starting) && 'cursor-not-allowed opacity-50'
          )}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Iniciando campaña…
            </>
          ) : running ? (
            <>
              <ShieldAlert className="h-4 w-4 anim-blink" /> Campaña en curso
            </>
          ) : (
            <>
              <Swords className="h-4 w-4" /> Iniciar campaña {selected ? '' : '(aleatoria)'}
              <Play className="h-4 w-4" />
            </>
          )}
          {!disabled && !starting && (
            <span className="pulse-ring-cyan absolute inset-0 rounded-xl" />
          )}
        </motion.button>
        <p className="text-center text-[11px] text-muted-foreground">
          Los agentes IA atacarán y defenderán durante 8 rondas. El conocimiento generado se archiva
          automáticamente para las próximas campañas.
        </p>
      </div>
    </div>
  )
}
