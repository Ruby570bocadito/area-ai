'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─────────────────────────────────────────────────────────────
// Atajos de teclado globales (atajos-teclado):
// · ?            — abre esta ayuda
// · ⌘K / Ctrl+K  — paleta de comandos (CommandPalette)
// · g + tecla    — salto de sección (p/o/a/c/h/n/m)
// · Esc          — cierra overlays (propio de los diálogos)
// La escucha es global pero se ignora mientras se escribe en
// campos de texto (inputs, textareas, selects, contentEditable),
// incluido el buscador de la propia paleta.
// ─────────────────────────────────────────────────────────────

const G_SEQUENCES: Record<string, { href: string; label: string }> = {
  p: { href: '/', label: 'Command deck' },
  o: { href: '/arena', label: 'Operations' },
  a: { href: '/agentes', label: 'Agents' },
  c: { href: '/conocimiento', label: 'Knowledge' },
  h: { href: '/historial', label: 'History' },
  n: { href: '/analitica', label: 'Analytics' },
  m: { href: '/modelos', label: 'Model Studio' },
}

// Ventana (ms) para completar la secuencia «g + tecla»
const G_WINDOW = 900

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable === true
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-surface-200 bg-white px-1.5 py-0.5 text-center font-mono-tight text-[10px] font-semibold text-ink-700 shadow-sm">
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[12.5px] text-ink-700">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
    </div>
  )
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  // «g» pendiente de segundo pulso: marca temporal en lugar de solo
  // booleano para que la secuencia caduque si el usuario se detiene.
  const gPendingAt = useRef<number>(0)

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      // ? (Shift+/) — ayuda
      if (e.key === '?') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }

      // g + tecla — salto de sección
      if (e.key === 'g' || e.key === 'G') {
        gPendingAt.current = Date.now()
        return
      }
      const gFresh = Date.now() - gPendingAt.current <= G_WINDOW
      gPendingAt.current = 0
      if (gFresh) {
        const dest = G_SEQUENCES[e.key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          router.push(dest.href)
        }
      }
    },
    [router]
  )

  useEffect(() => {
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onKey])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className="hidden h-8 w-8 items-center justify-center rounded-md border border-surface-200 bg-white text-ink-500 shadow-sm transition-colors hover:border-surface-300 hover:text-ink-900 md:flex"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-ink-900">Keyboard shortcuts</DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed text-ink-500">
              Move around the laboratory without touching the mouse. The “g” sequences complete in under a second.
            </DialogDescription>
          </DialogHeader>

          <div className="nice-scroll max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <section>
              <p className="mb-1 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Navigation
              </p>
              <div className="divide-y divide-surface-100">
                {Object.entries(G_SEQUENCES).map(([key, dest]) => (
                  <ShortcutRow key={dest.href} keys={['g', key]} label={dest.label} />
                ))}
              </div>
            </section>

            <section>
              <p className="mb-1 font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
                General
              </p>
              <div className="divide-y divide-surface-100">
                <ShortcutRow keys={['⌘', 'K']} label="Command palette (search and launch)" />
                <ShortcutRow keys={['?']} label="This help" />
                <ShortcutRow keys={['Esc']} label="Close dialogs" />
              </div>
            </section>
          </div>

          <p className="border-t border-surface-200 pt-3 text-[11px] leading-relaxed text-ink-400">
            Shortcuts are ignored while you are typing in a text field, and they do not interfere with browser combos
            (only a bare “g” without modifiers opens the sequence).
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
