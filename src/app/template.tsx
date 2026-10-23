// Transición compartida entre rutas (page-transitions).
//
// En el App Router, `template.tsx` se remonta en CADA navegación (a
// diferencia de `layout.tsx`), de modo que re-aplica la animación de
// entrada `.anim-route` (misma curva que el resto del producto:
// ai-rise-in 0,45 s cubic-bezier(0.2, 0.8, 0.2, 1)). Es un server
// component con cero JS cliente: el coste por navegación es una clase
// CSS, y `prefers-reduced-motion` la desactiva a nivel CSS (globals.css)
// — no hace falta MotionConfig aquí.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-route">{children}</div>
}
