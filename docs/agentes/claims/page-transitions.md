# claim: page-transitions

- ID: IMP-2
- Fecha: 2026-10-23 (Europe/Madrid)
- Rutas: src/app/template.tsx (nuevo), src/app/globals.css, docs/agentes/estado/IMP-2.md, docs/agentes/ROADMAP.md (solo tick de esta tarea)
- Detalle: transición compartida entre rutas con template.tsx (se remonta en cada navegación). Implementación SOLO CSS: nueva utilidad `.anim-route` que reutiliza los keyframes propios del producto (ai-rise-in 0,45 s cubic-bezier(0.2, 0.8, 0.2, 1)) con fill-mode `backwards` — a diferencia de `both`, al terminar no deja `transform: translateY(0)` persistente en el wrapper, evitando que el contenedor de página se convierta en bloque contenedor de futuros elementos position:fixed (verificado: no hay ninguno hoy en contenido de página; los overlays Radix portan a body). template.tsx es server component — cero JS cliente y sin wrapper framer-motion (MotionConfig reducedMotion="user" no hace falta aquí: la desactivación por prefers-reduced-motion ya está cubierta a nivel CSS junto a .anim-rise). Verificado que <main className="flex-1"> no depende de que su hijo sea flex item.
