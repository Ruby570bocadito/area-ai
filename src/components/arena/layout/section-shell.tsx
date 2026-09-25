'use client'

import { SectionTitle, Reveal } from '@/components/arena/section'

// ─────────────────────────────────────────────────────────────
// Sub-parte reutilizable: sección numerada con título, pie de
// sección y contenido. Mantiene page.tsx como composición fina.
// ─────────────────────────────────────────────────────────────

export function ArenaSection({
  id,
  index,
  kicker,
  title,
  subtitle,
  children,
}: {
  id: string
  index: string
  kicker: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} id={id} className="scroll-mt-20">
      <SectionTitle index={index} kicker={kicker} title={title} subtitle={subtitle} />
      <Reveal className="mt-6">{children}</Reveal>
    </section>
  )
}
