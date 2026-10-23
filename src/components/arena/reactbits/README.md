# React Bits — componentes integrados

Fuente oficial: https://github.com/DavidHDev/react-bits (variante `src/ts-default`,
copiada casi verbatim el 2026-10-23 por IMP-2, tarea `ui-pro-reactbits`).

- `particles/Particles` — fondo de partículas WebGL (héroe de la portada).
- `shiny-text/ShinyText` — brillo deslizante sobre texto (kicker del héroe).
- `gradient-text/GradientText` — degradado animado sobre texto (título del héroe).
- `glare-hover/GlareHover` — destello al pasar el cursor (tarjetas de escenario).

Sin dependencias nuevas: los cuatro solo usan `react` + su CSS propio.
Adaptaciones locales: rutas de import del CSS relativas y ajustes de estilo puntuales.
Cualquier actualización futura debe venir del repo oficial (protocolo §4: recursos
externos solo de dominio/repo oficial, una vez y documentados).
