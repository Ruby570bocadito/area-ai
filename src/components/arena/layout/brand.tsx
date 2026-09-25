import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Marca: emblema hexagonal (mitad ofensiva roja, mitad
// defensiva cian) + logotipo area·ai. Única fuente de verdad
// para navbar y footer.
// ─────────────────────────────────────────────────────────────

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-[#0a0c11]',
        className
      )}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="brand-red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4536e" stopOpacity="0.9" />
            <stop offset="1" stopColor="#f4536e" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="brand-cyan" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#41c0ef" stopOpacity="0.9" />
            <stop offset="1" stopColor="#41c0ef" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4536e" />
            <stop offset="1" stopColor="#41c0ef" />
          </linearGradient>
        </defs>
        <path d="M32 9 L13 20 L13 44 L32 55 Z" fill="url(#brand-red)" />
        <path d="M32 9 L51 20 L51 44 L32 55 Z" fill="url(#brand-cyan)" />
        <path d="M32 9 L51 20 L51 44 L32 55 L13 44 L13 20 Z" fill="none" stroke="url(#brand-grad)" strokeWidth="3" />
        <circle cx="32" cy="32" r="6.5" fill="url(#brand-grad)" />
      </svg>
    </span>
  )
}

export function Wordmark({ className, sub = true }: { className?: string; sub?: boolean }) {
  return (
    <span className={cn('leading-none', className)}>
      <span className="font-display block text-[15px] font-extrabold tracking-tight text-foreground">
        area<span className="bg-gradient-to-r from-[#f4536e] to-[#41c0ef] bg-clip-text text-transparent">·</span>ai
      </span>
      {sub && (
        <span className="mt-0.5 hidden font-mono-tight text-[8.5px] uppercase tracking-[0.3em] text-muted-foreground sm:block">
          Adversarial Lab
        </span>
      )}
    </span>
  )
}
