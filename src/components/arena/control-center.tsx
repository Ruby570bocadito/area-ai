'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Play, Loader2, RadioTower, Building2, Cpu, ShieldAlert, Swords, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioDTO } from '@/lib/api-types'

// Ilustraciones generadas para cada infraestructura objetivo
const SCENARIO_IMG: Record<string, string> = {
  novaretail: '/scenario-novaretail.png',
  'hospital-vitalis': '/scenario-hospital-vitalis.png',
  'technova-saas': '/scenario-technova-saas.png',
  'fincorp-bank': '/scenario-fincorp-bank.png',
  'enermax-grid': '/scenario-enermax-grid.png',
  'aerodefense-labs': '/scenario-aerodefense-labs.png',
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Dificultad ${level} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn('h-1 w-3 rounded-full', i < level ? 'bg-gradient-to-r from-[#e8b64c] to-[#f4536e]' : 'bg-white/10')}
        />
      ))}
    </span>
  )
}

const SPOTLIGHT_MOVE = (e: React.MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
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
    <div className="panel relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <RadioTower className="h-4.5 w-4.5 text-foreground/80" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight sm:text-lg">
              Selección de escenario
            </h3>
            <p className="text-xs text-muted-foreground">
              Elige la infraestructura objetivo y lanza una campaña autónoma Red vs Blue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono-tight text-[10px] text-muted-foreground">
            <Cpu className="h-3 w-3 text-[#41c0ef]" />
            Motor: <span className="text-foreground/85">{provider}</span>
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono-tight text-[10px]',
              running ? 'status-live' : 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full anim-blink', running ? 'bg-[#e8b64c]' : 'bg-emerald-400')} />
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
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(isSel ? null : s.id)}
              onMouseMove={SPOTLIGHT_MOVE}
              disabled={running}
              className={cn(
                'group relative overflow-hidden rounded-xl border text-left transition-all disabled:opacity-50',
                isSel
                  ? 'edge-glow border-transparent bg-white/[0.05]'
                  : 'border-white/[0.07] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.035]'
              )}
            >
              {/* halo de selección */}
              {isSel && (
                <motion.span
                  layoutId="sel-halo"
                  className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-1 ring-white/25"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              {/* ilustración de la infraestructura */}
              <div className="scenario-media h-24 sm:h-28">
                <Image
                  src={SCENARIO_IMG[s.key] ?? '/og.png'}
                  alt=""
                  fill
                  sizes="(min-width:1280px) 33vw, (min-width:640px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 p-2.5">
                  <span className="font-mono-tight truncate text-[11px] font-bold tracking-[0.14em] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                    {s.codename}
                  </span>
                  <DifficultyDots level={s.difficulty} />
                </div>
                {isSel && (
                  <motion.span
                    layoutId="sel-check"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-mono-tight text-[9px] font-bold text-[#0a0b0f] shadow-lg"
                  >
                    <Check className="h-2.5 w-2.5" /> SELECCIONADO
                  </motion.span>
                )}
              </div>
              <div className="p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.company}</span>
                </p>
                <p className="mt-0.5 font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.industry}
                </p>
                <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Botón de inicio */}
      <div className="relative z-10 mt-6 flex flex-col items-center gap-2.5">
        <motion.button
          type="button"
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          onClick={handleStart}
          disabled={disabled || starting}
          className={cn(
            'shine-sweep relative flex items-center gap-2.5 rounded-lg px-8 py-3.5 text-sm font-semibold transition-all',
            'bg-white text-[#0a0b0f] shadow-[0_8px_30px_-10px_rgba(255,255,255,0.4)] hover:bg-white/92',
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
              <Swords className="h-4 w-4" />
              Iniciar campaña {selected ? '' : '(escenario aleatorio)'}
              <Play className="h-3.5 w-3.5" />
            </>
          )}
        </motion.button>
        <p className="max-w-md text-center text-[11.5px] leading-relaxed text-muted-foreground">
          Los agentes combatirán durante 8 rondas. El conocimiento generado se archiva
          automáticamente y se inyecta en las próximas campañas.
        </p>
      </div>
    </div>
  )
}
