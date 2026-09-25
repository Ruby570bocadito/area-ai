import type { Metadata, Viewport } from "next";
import { Geist_Mono, Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// ── Tipografía premium ────────────────────────────────────────
// Sora: display geométrico para titulares (aire de AI lab moderno)
const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Inter: estándar de producto SaaS profesional
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// JetBrains Mono: datos, métricas y etiquetas técnicas
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Geist Mono se mantiene como respaldo del sistema
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "area·ai — Simulador adversarial autónomo · Red Team vs Blue Team",
  description:
    "Agentes de IA ofensivos y defensivos libran campañas continuas sobre infraestructura empresarial simulada. Cada combate genera conocimiento que se archiva, se reutiliza y hace evolucionar a ambos equipos.",
  keywords: [
    "red team",
    "blue team",
    "ciberseguridad",
    "inteligencia artificial",
    "agentes autónomos",
    "simulador adversarial",
    "sandbox",
  ],
  authors: [{ name: "area·ai" }],
  openGraph: {
    title: "area·ai — Simulador adversarial autónomo",
    description:
      "Red Team vs Blue Team con agentes de IA en evolución continua.",
    type: "website",
    images: [{ url: "/og.png", width: 1440, height: 704, alt: "area·ai — laboratorio adversarial" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "area·ai — Simulador adversarial autónomo",
    description: "Red Team vs Blue Team con agentes de IA en evolución continua.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${inter.variable} ${jetbrains.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
