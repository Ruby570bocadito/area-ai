import type { NextConfig } from "next";

// Cabeceras de seguridad en TODAS las respuestas (hallazgo Ronda 11 de
// bugs, auditoría de superficie). Solo se incluyen las que NO pueden
// alterar la ejecución de la app:
//   · nosniff — evita sniffing de MIME en respuestas servidas por la app.
//   · X-Frame-Options SAMEORIGIN — el panel no está pensado para embeberse
//     en orígenes terceros (clickjacking).
//   · Referrer-Policy — no filtra URLs internas hacia terceros.
//   · Permissions-Policy — el producto no usa cámara/mic/geo.
//   · COOP/CORP same-origin (tarea cabeceras-extra del ROADMAP) — aíslan el
//     contexto de navegación y los recursos de documentos ajenos
//     (ataques Spectre/XS-Leaks). Seguras aquí: la app no abre popups
//     cross-origin ni embebe recursos de otros orígenes, y todo lo que
//     sirve es mismo-origen (el arenero no se embebe desde terceros).
// Una CSP estricta (script-src sin 'unsafe-inline') exige verificación de
// hidratación en navegador real (no disponible en este entorno): queda como
// recomendación documentada en el informe de la ronda, no como cambio ciego.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  /* La barrera de tipos está activa en el build: `tsc --noEmit` está limpio
     y un error de tipos debe romper el build de producción en lugar de
     ignorarse en silencio (los contratos de guard/access/proxy son de
     seguridad). */
  reactStrictMode: false,
  async headers() {
    return [
      {
        // `/:path*` también cubre la raíz `/`.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Datos vivos de la simulación (tarea cabeceras-extra): las respuestas
        // de la API nunca se cachean — un proxy intermedio no debe servir un
        // estado de arena obsoleto ni conservar fragmentos de configuración
        // (aunque los secretos ya se devuelven enmascarados).
        // Los assets estáticos de Next (/_next/static) conservan su caché
        // immutable: esta regla solo aplica a /api/*.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
