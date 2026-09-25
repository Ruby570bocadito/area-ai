import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* La barrera de tipos está activa en el build: `tsc --noEmit` está limpio
     y un error de tipos debe romper el build de producción en lugar de
     ignorarse en silencio (los contratos de guard/access/proxy son de
     seguridad). */
  reactStrictMode: false,
};

export default nextConfig;
