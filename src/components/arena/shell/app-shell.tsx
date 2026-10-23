'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import {
  LayoutDashboard,
  Radio,
  Users,
  BrainCircuit,
  History,
  BarChart3,
  SlidersHorizontal,
  Menu,
  X,
  Cpu,
  Infinity as InfinityIcon,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArena } from './arena-provider'
import { CommandPalette } from '@/components/arena/command-palette'
import { KeyboardShortcuts } from '@/components/arena/shell/keyboard-shortcuts'
import { BrandMark, Wordmark } from '@/components/arena/layout/brand'
import { Footer } from '@/components/arena/layout/footer'

// ─────────────────────────────────────────────────────────────
// AppShell — estructura de aplicación multi-página:
// · Sidebar corporativa (navy) con navegación por rutas
// · Topbar con título de página, estado del motor y ⌘K
// · Móvil: topbar compacta + panel de navegación deslizante
// ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/', label: 'Deck', icon: LayoutDashboard },
  { href: '/arena', label: 'Operations', icon: Radio },
  { href: '/agentes', label: 'Agents', icon: Users },
  { href: '/conocimiento', label: 'Knowledge', icon: BrainCircuit },
  { href: '/historial', label: 'History', icon: History },
  { href: '/analitica', label: 'Analytics', icon: BarChart3 },
  { href: '/modelos', label: 'Models', icon: SlidersHorizontal },
] as const

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Command deck', sub: 'Laboratory overview' },
  '/arena': { title: 'Live operations', sub: 'Telemetry of the active campaign' },
  '/agentes': { title: 'AI agents', sub: 'Roster of autonomous operators' },
  '/conocimiento': { title: 'Knowledge base', sub: 'The system’s evolving memory' },
  '/historial': { title: 'Campaign history', sub: 'Archive of engagements' },
  '/analitica': { title: 'Analytics', sub: 'Aggregate reading of the laboratory' },
  '/modelos': { title: 'Model Studio', sub: 'The agents’ LLM engine' },
}

function pageMeta(pathname: string): { title: string; sub: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Known nested routes (e.g. campaign detail /historial/[id])
  if (pathname.startsWith('/historial/'))
    return { title: 'Campaign detail', sub: 'Full record of the engagement' }
  return { title: 'area·ai', sub: '' }
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { state, running, status, dbStatus } = useArena()
  // Modo determinista activo: la campaña en pantalla arrancó en SIM
  // (el LLM no estaba disponible al lanzarla; engine.ts lo persiste).
  const deterministic = state?.liveCampaign?.engineMode === 'SIM'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3">
          <BrandMark />
          <Wordmark tone="dark" />
        </Link>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              className="side-link relative"
            >
              {active && (
                <motion.span
                  layoutId="side-active"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#d92d20] to-[#0086c9]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-ink-500')} />
              <span className="truncate">{item.label}</span>
              {item.href === '/arena' && running && (
                <span className="ml-auto flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#d97706] pulse-dot" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Estado del sistema (barra-estado-sistema): salud de BD (healthcheck
          GET /api clasificado en use-arena-state), lab HTTP real, motor LLM y
          modo determinista, junto al chip de conexión (H-005). */}
      <div className="mx-3 mb-5 rounded-xl border border-surface-200 bg-surface-50 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-500">
            <Cpu className="h-3 w-3" /> System
          </span>
          {/* El chip describe la CONEXIÓN con el motor (H-005): si el sondeo
              falla, rojo «Sin conexión» con prioridad sobre «En directo/En
              espera» — nunca verde mientras /api responde 503. */}
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
              status === 'offline'
                ? 'bg-[#fef3f2] text-[#b42318]'
                : running
                  ? 'bg-[#fffaeb] text-[#b54708]'
                  : 'bg-[#ecfdf3] text-[#067647]'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'offline'
                  ? 'bg-[#f04438]'
                  : running
                    ? 'pulse-dot bg-[#fdb022]'
                    : 'pulse-dot bg-[#12b76a]'
              )}
            />
            {status === 'offline' ? 'Disconnected' : running ? 'Live' : 'Standby'}
          </span>
        </div>
        {/* Filas de salud — sin estado cargado (conectando o motor caído)
            se muestra «—», nunca un valor supuesto (H-005). */}
        <dl className="mt-2.5 space-y-1.5 border-t border-surface-200 pt-2.5 font-mono-tight text-[9.5px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-500">DB</dt>
            <dd
              className={cn(
                'flex items-center gap-1 font-semibold',
                dbStatus === 'up' ? 'text-[#067647]' : dbStatus === 'down' ? 'text-[#b42318]' : 'text-ink-400'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  dbStatus === 'up' ? 'bg-[#12b76a]' : dbStatus === 'down' ? 'bg-[#f04438]' : 'bg-surface-300'
                )}
              />
              {dbStatus === 'up' ? 'Operational' : dbStatus === 'down' ? 'Down' : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-500">Lab HTTP</dt>
            <dd
              className={cn(
                'truncate font-semibold',
                state?.lab.online ? 'text-[#067647]' : 'text-ink-400'
              )}
            >
              {state ? (state.lab.online ? `Online :${state.lab.port ?? '—'}` : 'Offline') : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-500">LLM engine</dt>
            <dd className="flex min-w-0 items-center gap-1 text-ink-600">
              {deterministic && (
                <span
                  title="The on-screen campaign started in deterministic simulation: the LLM was unavailable when it launched"
                  className="shrink-0 rounded-full bg-[#fffaeb] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wider text-[#b54708]"
                >
                  Deterministic
                </span>
              )}
              <span className="truncate">{state?.provider ?? '—'}</span>
            </dd>
          </div>
        </dl>
        <div className="mt-2.5 flex items-center justify-between border-t border-surface-200 pt-2.5 font-mono-tight text-[9.5px] text-ink-500">
          <span>{state ? `${state.stats.totalCampaigns} campaigns` : '— campaigns'}</span>
          <span className="flex items-center gap-1">
            {state?.autopilot && <InfinityIcon className="h-3 w-3 text-[#7c3aed]" />}
            {state ? `${state.stats.knowledgeCount} lessons` : '— lessons'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { running, status, state } = useArena()
  const meta = pageMeta(pathname)

  return (
    /* reducedMotion="user": todas las animaciones de framer-motion (layoutId,
       entradas, paneles deslizantes) respetan prefers-reduced-motion del
       sistema; los fundidos de opacidad se mantienen. Los haces, partículas,
       barridos y NumberFlow se cubren en globals.css y por defecto en NumberFlow. */
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen">
      {/* Sidebar de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[246px] flex-col border-r border-surface-200 bg-white lg:flex">
        <SideNav />
      </aside>

      {/* Área principal */}
      <div className="flex min-h-screen w-full flex-col lg:pl-[246px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-surface-200 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {/* Menú móvil */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-200 bg-white text-ink-700 transition-colors hover:bg-surface-100 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="min-w-0"
                  >
                    <p className="font-display truncate text-[15px] font-semibold leading-tight text-ink-900">
                      {meta.title}
                    </p>
                    <p className="hidden truncate text-[11px] leading-tight text-ink-500 sm:block">{meta.sub}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <CommandPalette />
              <KeyboardShortcuts />
              {/* Misma semántica de conexión que el widget del sidebar (H-005):
                  rojo «Sin conexión» mientras el sondeo falla. */}
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tight text-[10px] font-bold uppercase tracking-wider',
                  status === 'offline'
                    ? 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]'
                    : running
                      ? 'status-live'
                      : 'border-surface-200 bg-white text-ink-500'
                )}
                title={
                  status === 'offline'
                    ? 'The engine poll is failing; retrying automatically'
                    : undefined
                }
              >
                {status === 'offline' ? (
                  <WifiOff className="h-3 w-3" />
                ) : (
                  <Radio className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">
                  {status === 'offline' ? 'Disconnected' : running ? 'Live' : 'Standby'}
                </span>
                {running && status !== 'offline' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d97706] pulse-dot" />
                )}
              </span>
            </div>
          </div>
        </header>

        {status === 'offline' && state != null && (
          /* Datos en pantalla pero el sondeo está fallando: aviso persistente
             de desconexión (sin tapar el contenido, reintentando en fondo). */
          <div role="status" aria-live="polite" className="sticky top-14 z-20 border-b border-[#fedf89] bg-[#fffaeb]">
            <p className="mx-auto flex h-9 w-full max-w-[1240px] items-center justify-center gap-2 px-4 font-mono-tight text-[11px] font-semibold text-[#b54708] sm:px-6 lg:px-8">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              Disconnected from the engine — data may be stale; retrying…
            </p>
          </div>
        )}

        <main className="flex-1">{children}</main>

        <Footer />
      </div>

      {/* Navegación móvil */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm lg:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-surface-200 bg-white shadow-2xl lg:hidden"
              role="dialog"
              aria-label="Navigation"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-surface-100 hover:text-ink-900"
              >
                <X className="h-4 w-4" />
              </button>
              <SideNav onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
