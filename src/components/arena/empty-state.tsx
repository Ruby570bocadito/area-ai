'use client'

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Estado vacío con guía de siguiente paso. Variante completa
// (panel con icono y CTA) para listas y pestañas; variante
// compacta para huecos pequeños (gráficos, tarjetas de agente).
// ─────────────────────────────────────────────────────────────

type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void }

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  action?: EmptyStateAction
  compact?: boolean
}) {
  const actionEl = action ? (
    'href' in action ? (
      <Link
        href={action.href}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230]"
      >
        {action.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    ) : (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-50"
      >
        {action.label}
      </button>
    )
  ) : null

  if (compact) {
    return (
      <div role="status" className="flex h-full min-h-[88px] w-full flex-col items-center justify-center gap-1.5 px-4 py-3 text-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-200 bg-surface-50">
          <Icon className="h-3.5 w-3.5 text-ink-400" aria-hidden />
        </span>
        <p className={cn('text-[12px] font-semibold', 'text-ink-700')}>{title}</p>
        {description && (
          <p className="max-w-sm text-[11.5px] leading-relaxed text-ink-400">{description}</p>
        )}
        {actionEl}
      </div>
    )
  }

  return (
    <div role="status" className="panel flex flex-col items-center gap-3 rounded-xl px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-100">
        <Icon className="h-4.5 w-4.5 text-ink-500" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-500">{description}</p>
        )}
      </div>
      {actionEl}
    </div>
  )
}
