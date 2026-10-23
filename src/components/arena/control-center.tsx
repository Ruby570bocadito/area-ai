'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Loader2, RadioTower, Building2, Cpu, ShieldAlert, Swords, Check, Infinity as InfinityIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ScenarioDTO } from '@/lib/api-types'
import { ScenarioArt } from '@/components/arena/scenario-art'
import GlareHover from '@/components/arena/reactbits/glare-hover/GlareHover'

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Difficulty ${level} out of 5`}>
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
  const [confirmOpen, setConfirmOpen] = useState(false)

  const selectedScenario = selected ? (scenarios.find((s) => s.id === selected) ?? null) : null

  // Cerrojo de doble clic: el botón principal abre la confirmación ligera
  // y el lanzamiento real solo ocurre desde el diálogo, con el mismo lock.
  const handleStart = async () => {
    if (disabled || starting) return
    setStarting(true)
    try {
      await onStart(selected ?? undefined)
      setConfirmOpen(false)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="panel relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-100">
            <RadioTower className="h-4.5 w-4.5 text-ink-700" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight text-ink-900 sm:text-lg">
              Launch center
            </h3>
            <p className="text-xs text-ink-500">
              Pick the target infrastructure and launch an autonomous Red vs Blue campaign
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-white px-3 py-1.5 font-mono-tight text-[10px] text-ink-500">
            <Cpu className="h-3 w-3 text-[#0086c9]" />
            Engine: <span className="text-ink-900">{provider}</span>
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono-tight text-[10px] font-bold uppercase tracking-wider',
              running ? 'status-live' : 'border-[#a6f4c5] bg-[#ecfdf3] text-[#067647]'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full pulse-dot', running ? 'bg-[#d97706]' : 'bg-[#12b76a]')} />
            {running ? 'Campaign in progress' : 'System ready'}
          </span>
        </div>
      </div>

      {/* Operación continua — campañas reales en segundo plano */}
      <div
        className={cn(
          'relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
          autopilot ? 'border-[#ddd6fe] bg-[#f5f3ff]' : 'border-surface-200 bg-surface-50'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              autopilot ? 'border-[#ddd6fe] bg-white text-[#6941c6]' : 'border-surface-200 bg-white text-ink-500'
            )}
          >
            <InfinityIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-900">Continuous operation</p>
            <p className="text-[11px] leading-snug text-ink-500">
              {autopilot
                ? 'On — the engine chains real campaigns in the background, with a short cool-down between them.'
                : 'Turn it on and the engine will chain real campaigns hands-free, scenario after scenario.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autopilot}
          aria-label="Continuous operation"
          onClick={() => onToggleAutopilot(!autopilot)}
          className={cn(
            'relative h-6.5 w-11 shrink-0 rounded-full border transition-colors',
            autopilot ? 'border-[#7c3aed] bg-[#7c3aed]' : 'border-surface-300 bg-[#eaecf0]'
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
                  : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-[0_4px_16px_-8px_rgba(16,24,40,0.18)]'
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
              {/* ilustración procedural de la red objetivo (ScenarioArt, SVG
                  determinista por escenario — sustituye a las imágenes
                  generadas por IA) con destello al pasar el cursor (React
                  Bits GlareHover, respeta prefers-reduced-motion) */}
              <div className="scenario-media relative h-24 sm:h-28">
                <GlareHover
                  width="100%"
                  height="100%"
                  background="transparent"
                  borderRadius="0px"
                  borderColor="transparent"
                  glareColor="#ffffff"
                  glareOpacity={0.28}
                  glareSize={22}
                  mode="follow"
                  transitionDuration={900}
                >
                  <ScenarioArt seed={s.key} />
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
                      <Check className="h-2.5 w-2.5" /> SELECTED
                    </motion.span>
                  )}
                </GlareHover>
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
          onClick={() => setConfirmOpen(true)}
          disabled={disabled || starting}
          className={cn(
            'shine-sweep relative flex items-center gap-2.5 rounded-lg px-8 py-3.5 text-sm font-semibold transition-all',
            'bg-ink-900 text-white shadow-[0_8px_24px_-10px_rgba(16,24,40,0.5)] hover:bg-[#182230]',
            (disabled || starting) && 'cursor-not-allowed opacity-50'
          )}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Starting campaign…
            </>
          ) : running ? (
            <>
              <ShieldAlert className="h-4 w-4 pulse-dot" /> Campaign in progress
            </>
          ) : (
            <>
              <Swords className="h-4 w-4" />
              Start campaign {selected ? '' : '(random scenario)'}
              <Play className="h-3.5 w-3.5" />
            </>
          )}
        </motion.button>
        <p className="max-w-md text-center text-[11.5px] leading-relaxed text-ink-500">
          The agents will fight for 12 rounds. Generated knowledge is archived automatically
          and injected into upcoming campaigns.
        </p>
      </div>

      {/* Confirmación ligera antes de lanzar: evita arranques accidentales
          sin fricción extra (un solo paso más, con el escenario visible). */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !starting && setConfirmOpen(open)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-ink-900">
              Launch this campaign?
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed text-ink-500">
              {selectedScenario ? (
                <>
                  Target infrastructure: <span className="font-semibold text-ink-700">{selectedScenario.codename}</span>{' '}
                  — {selectedScenario.company}.
                </>
              ) : (
                'Random scenario: the engine will pick the target infrastructure.'
              )}{' '}
              12 real Red vs Blue rounds will be played against the local laboratory.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 font-mono-tight text-[10px] text-ink-500">
            <span className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1">
              <Cpu className="h-3 w-3 text-[#0086c9]" /> Engine: <span className="font-semibold text-ink-700">{provider}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1">
              <Swords className="h-3 w-3 text-ink-400" /> 12 rounds
            </span>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={starting}
              className="rounded-lg border border-surface-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={disabled || starting}
              className="flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Launch campaign
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
