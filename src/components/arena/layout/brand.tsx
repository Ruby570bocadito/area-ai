import { useId } from 'react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Marca: emblema hexagonal (mitad ofensiva roja, mitad
// defensiva azul) + logotipo area·ai. Única fuente de verdad
// para sidebar, footer y navegación móvil. Los IDs de los
// gradientes son únicos por instancia (varios emblemas pueden
// coexistir en el DOM).
// ─────────────────────────────────────────────────────────────

export function BrandMark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gRed = `brand-red-${uid}`
  const gCyan = `brand-cyan-${uid}`
  const gGrad = `brand-grad-${uid}`
  return (
    <span
      className={cn(
        'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-[#101828]',
        className
      )}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={gRed} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f97066" stopOpacity="0.95" />
            <stop offset="1" stopColor="#d92d20" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={gCyan} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#36bffa" stopOpacity="0.95" />
            <stop offset="1" stopColor="#0086c9" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={gGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f97066" />
            <stop offset="1" stopColor="#36bffa" />
          </linearGradient>
        </defs>
        <path d="M32 9 L13 20 L13 44 L32 55 Z" fill={`url(#${gRed})`} />
        <path d="M32 9 L51 20 L51 44 L32 55 Z" fill={`url(#${gCyan})`} />
        <path d="M32 9 L51 20 L51 44 L32 55 L13 44 L13 20 Z" fill="none" stroke={`url(#${gGrad})`} strokeWidth="3" />
        <circle cx="32" cy="32" r="6.5" fill={`url(#${gGrad})`} />
      </svg>
    </span>
  )
}

export function Wordmark({
  className,
  sub = true,
  tone = 'dark',
}: {
  className?: string
  sub?: boolean
  tone?: 'dark' | 'light'
}) {
  return (
    <span className={cn('leading-none', className)}>
      <span
        className={cn(
          'font-display block text-[15px] font-extrabold tracking-tight',
          tone === 'light' ? 'text-white' : 'text-[#101828]'
        )}
      >
        area<span className="bg-gradient-to-r from-[#d92d20] to-[#0086c9] bg-clip-text text-transparent">·</span>ai
      </span>
      {sub && (
        <span
          className={cn(
            'mt-0.5 hidden font-mono-tight text-[8.5px] uppercase tracking-[0.28em] sm:block',
            tone === 'light' ? 'text-[#8a94a6]' : 'text-[#667085]'
          )}
        >
          Adversarial Lab
        </span>
      )}
    </span>
  )
}
