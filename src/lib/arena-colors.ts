/**
 * Tokens de color del duelo RED/BLUE compartidos por los componentes
 * de visualización (gráficas SVG, barras y leyendas del análisis).
 *
 * Fuente única de los literales que antes se repetían en cada fichero;
 * espejo exacto de las variables CSS `--arena-red` / `--arena-blue` de
 * `globals.css` (mismos valores por diseño — si se ajusta la paleta,
 * actualizar ambos sitios y los clases `bg-[#…]` que los citan).
 */
export const ARENA_RED = '#d92d20'
export const ARENA_BLUE = '#0086c9'
