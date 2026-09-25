'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArena } from './arena-provider'
import { CommandPalette } from '@/components/arena/command-palette'
import { BrandMark, Wordmark } from '@/components/arena/layout/brand'
import { Footer } from '@/components/arena/layout/footer'

// ─────────────────────────────────────────────────────────────
// AppShell — estructura de aplicación multi-página:
// · Sidebar corporativa (navy) con navegación por rutas
// · Topbar con título de página, estado del motor y ⌘K
// · Móvil: topbar compacta + panel de navegación deslizante
// ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/', label: 'Panel', icon: LayoutDashboard },
  { href: '/arena', label: 'Operaciones', icon: Radio },
  { href: '/agentes', label: 'Agentes', icon: Users },
  { href: '/conocimiento', label: 'Conocimiento', icon: BrainCircuit },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/analitica', label: 'Analítica', icon: BarChart3 },
  { href: '/modelos', label: 'Modelos', icon: SlidersHorizontal },
] as const

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Panel de mando', sub: 'Visión general del laboratorio' },
  '/arena': { title: 'Operaciones en vivo', sub: 'Telemetría de la campaña activa' },
  '/agentes': { title: 'Agentes IA', sub: 'Roster de operadores autónomos' },
  '/conocimiento': { title: 'Base de conocimiento', sub: 'Memoria en evolución del sistema' },
  '/historial': { title: 'Historial de campañas', sub: 'Archivo de enfrentamientos' },
  '/analitica': { title: 'Analítica', sub: 'Lectura agregada del laboratorio' },
  '/modelos': { title: 'Model Studio', sub: 'Motor LLM de los agentes' },
}

function pageMeta(pathname: string): { title: string; sub: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Rutas anidadas conocidas (p. ej. ficha de campaña /historial/[id])
  if (pathname.startsWith('/historial/'))
    return { title: 'Detalle de campaña', sub: 'Ficha completa del enfrentamiento' }
  return { title: 'area·ai', sub: '' }
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { state, running } = useArena()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3">
          <BrandMark />
          <Wordmark tone="dark" />
        </Link>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 px-3">
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
              <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-[#667085]')} />
              <span className="truncate">{item.label}</span>
              {item.href === '/arena' && running && (
                <span className="ml-auto flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#d97706] pulse-dot" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Estado del laboratorio */}
      <div className="mx-3 mb-5 rounded-xl border border-[#e4e7ec] bg-[#f9fafb] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#667085]">
            <Cpu className="h-3 w-3" /> Motor
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
              running ? 'bg-[#fffaeb] text-[#b54708]' : 'bg-[#ecfdf3] text-[#067647]'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full pulse-dot', running ? 'bg-[#fdb022]' : 'bg-[#12b76a]')} />
            {running ? 'En directo' : 'En espera'}
          </span>
        </div>
        <p className="mt-2 truncate font-mono-tight text-[10.5px] text-[#475467]">
          {state?.provider ?? 'z-ai-sdk'}
        </p>
        <div className="mt-2.5 flex items-center justify-between border-t border-[#e4e7ec] pt-2.5 font-mono-tight text-[9.5px] text-[#667085]">
          <span>{state?.stats.totalCampaigns ?? 0} campañas</span>
          <span className="flex items-center gap-1">
            {state?.autopilot && <InfinityIcon className="h-3 w-3 text-[#7c3aed]" />}
            {state?.stats.knowledgeCount ?? 0} lecciones
          </span>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { running } = useArena()
  const meta = pageMeta(pathname)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[246px] flex-col border-r border-[#e4e7ec] bg-white lg:flex">
        <SideNav />
      </aside>

      {/* Área principal */}
      <div className="flex min-h-screen w-full flex-col lg:pl-[246px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-[#e4e7ec] bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {/* Menú móvil */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir navegación"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white text-[#344054] transition-colors hover:bg-[#f2f4f7] lg:hidden"
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
                    <p className="font-display truncate text-[15px] font-semibold leading-tight text-[#101828]">
                      {meta.title}
                    </p>
                    <p className="hidden truncate text-[11px] leading-tight text-[#667085] sm:block">{meta.sub}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <CommandPalette />
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tight text-[10px] font-bold uppercase tracking-wider',
                  running
                    ? 'status-live'
                    : 'border-[#e4e7ec] bg-white text-[#667085]'
                )}
              >
                <Radio className="h-3 w-3" />
                <span className="hidden sm:inline">{running ? 'En directo' : 'En espera'}</span>
                {running && <span className="h-1.5 w-1.5 rounded-full bg-[#d97706] pulse-dot" />}
              </span>
            </div>
          </div>
        </header>

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
              className="fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-sm lg:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-[#e4e7ec] bg-white shadow-2xl lg:hidden"
              role="dialog"
              aria-label="Navegación"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar navegación"
                className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828]"
              >
                <X className="h-4 w-4" />
              </button>
              <SideNav onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
