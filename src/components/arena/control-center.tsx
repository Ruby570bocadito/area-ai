'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Play, Loader2, RadioTower, Building2, Cpu, ShieldAlert, Swords, Check, Infinity as InfinityIcon } from 'lucide-react'
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
          className={cn('h-1 w-3 rounded-full', i < level ? 'bg-gradient-to-r from-[#fdb022] to-[#f97066]' : 'bg-white/35')}
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
  autopilot,
  onToggleAutopilot,
  onStart,
}: {
  scenarios: ScenarioDTO[]
  running: boolean
  provider: string
  disabled: boolean
  autopilot: boolean
  onToggleAutopilot: (enabled: boolean) => void
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e4e7ec] bg-[#f2f4f7]">
            <RadioTower className="h-4.5 w-4.5 text-[#344054]" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight text-ink-900 sm:text-lg">
              Centro de lanzamiento
            </h3>
            <p className="text-xs text-ink-500">
              Elige la infraestructura objetivo y lanza una campaña autónoma Red vs Blue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[#e4e7ec] bg-white px-3 py-1.5 font-mono-tight text-[10px] text-ink-500">
            <Cpu className="h-3 w-3 text-[#0086c9]" />
            Motor: <span className="text-ink-900">{provider}</span>
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono-tight text-[10px] font-bold uppercase tracking-wider',
              running ? 'status-live' : 'border-[#a6f4c5] bg-[#ecfdf3] text-[#067647]'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full pulse-dot', running ? 'bg-[#d97706]' : 'bg-[#12b76a]')} />
            {running ? 'Campaña en curso' : 'Sistema listo'}
          </span>
        </div>
      </div>

      {/* Operación continua — campañas reales en segundo plano */}
      <div
        className={cn(
          'relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
          autopilot ? 'border-[#ddd6fe] bg-[#f5f3ff]' : 'border-[#e4e7ec] bg-[#f9fafb]'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              autopilot ? 'border-[#ddd6fe] bg-white text-[#6941c6]' : 'border-[#e4e7ec] bg-white text-ink-500'
            )}
          >
            <InfinityIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-900">Operación continua</p>
            <p className="text-[11px] leading-snug text-ink-500">
              {autopilot
                ? 'Activado — el motor encadena campañas reales en segundo plano, con un breve periodo de calma entre ellas.'
                : 'Actívalo y el motor encadenará campañas reales sin intervención, escenario tras escenario.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autopilot}
          aria-label="Operación continua"
          onClick={() => onToggleAutopilot(!autopilot)}
          className={cn(
            'relative h-6.5 w-11 shrink-0 rounded-full border transition-colors',
            autopilot ? 'border-[#7c3aed] bg-[#7c3aed]' : 'border-[#d0d5dd] bg-[#eaecf0]'
          )}
        >
          <motion.span
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={cn(
              'absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow',
              autopilot ? 'right-[3px]' : 'left-[3px]'
            )}
          />
        </button>
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
                  ? 'border-ink-900 bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.35)]'
                  : 'border-[#e4e7ec] bg-white hover:border-[#d0d5dd] hover:shadow-[0_4px_16px_-8px_rgba(16,24,40,0.18)]'
              )}
            >
              {/* halo de selección */}
              {isSel && (
                <motion.span
                  layoutId="sel-halo"
                  className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-2 ring-ink-900/15"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              {/* ilustración de la infraestructura — priority solo en la primera:
                  es la LCP de la portada (aviso de next dev); precargar las 6 sería contraproducente */}
              <div className="scenario-media h-24 sm:h-28">
                <Image
                  src={SCENARIO_IMG[s.key] ?? '/og.png'}
                  alt=""
                  fill
                  sizes="(min-width:1280px) 33vw, (min-width:640px) 50vw, 100vw"
                  className="object-cover"
                  priority={i === 0}
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
                    className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-ink-900 px-2 py-0.5 font-mono-tight text-[9px] font-bold text-white shadow-lg"
                  >
                    <Check className="h-2.5 w-2.5" /> SELECCIONADO
                  </motion.span>
                )}
              </div>
              <div className="p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span className="truncate">{s.company}</span>
                </p>
                <p className="mt-0.5 font-mono-tight text-[10px] uppercase tracking-wider text-ink-400">
                  {s.industry}
                </p>
                <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-ink-500">{s.description}</p>
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
            'bg-ink-900 text-white shadow-[0_8px_24px_-10px_rgba(16,24,40,0.5)] hover:bg-[#182230]',
            (disabled || starting) && 'cursor-not-allowed opacity-50'
          )}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Iniciando campaña…
            </>
          ) : running ? (
            <>
              <ShieldAlert className="h-4 w-4 pulse-dot" /> Campaña en curso
            </>
          ) : (
            <>
              <Swords className="h-4 w-4" />
              Iniciar campaña {selected ? '' : '(escenario aleatorio)'}
              <Play className="h-3.5 w-3.5" />
            </>
          )}
        </motion.button>
        <p className="max-w-md text-center text-[11.5px] leading-relaxed text-ink-500">
          Los agentes combatirán durante 8 rondas. El conocimiento generado se archiva
          automáticamente y se inyecta en las próximas campañas.
        </p>
      </div>
    </div>
  )
}
