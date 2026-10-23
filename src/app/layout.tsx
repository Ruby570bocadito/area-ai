import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ArenaProvider } from "@/components/arena/shell/arena-provider";
import { AppShell } from "@/components/arena/shell/app-shell";

// ── Tipografía profesional ───────────────────────────────────
// Inter Tight: titulares de producto (tracking ajustado)
const interTight = Inter_Tight({
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

// JetBrains Mono: datos, métricas e identificadores
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "area·ai — Autonomous adversarial simulator · Red Team vs Blue Team",
  description:
    "Offensive and defensive AI agents wage continuous campaigns against simulated enterprise infrastructure. Every engagement generates knowledge that is archived, reused and evolves both teams.",
  keywords: [
    "red team",
    "blue team",
    "cybersecurity",
    "artificial intelligence",
    "autonomous agents",
    "adversarial simulator",
    "sandbox",
  ],
  authors: [{ name: "area·ai" }],
  openGraph: {
    title: "area·ai — Autonomous adversarial simulator",
    description:
      "Red Team vs Blue Team with AI agents in continuous evolution.",
    type: "website",
    images: [{ url: "/og.png", width: 1440, height: 704, alt: "area·ai — adversarial laboratory" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "area·ai — Autonomous adversarial simulator",
    description: "Red Team vs Blue Team with AI agents in continuous evolution.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f5f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${interTight.variable} ${inter.variable} ${jetbrains.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ArenaProvider>
          <AppShell>{children}</AppShell>
        </ArenaProvider>
        <Toaster />
      </body>
    </html>
  );
}
