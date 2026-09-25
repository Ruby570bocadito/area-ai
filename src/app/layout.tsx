import type { Metadata } from "next";
import { Geist, Geist_Mono, Chakra_Petch, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografía display militar/tech para titulares profesionales
const chakraPetch = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Tipografía moderna para cuerpo de texto
const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AEGIS ARENA — Autonomous Cyber Warfare Sandbox · Red vs Blue AI",
  description:
    "Simulador de ciberseguridad con agentes de IA: equipos Red Team y Blue Team libran campañas en escenarios empresariales, aprenden de cada combate y evolucionan automáticamente.",
  keywords: [
    "red team",
    "blue team",
    "ciberseguridad",
    "IA",
    "simulador",
    "sandbox",
    "autoevolución",
  ],
  authors: [{ name: "AEGIS ARENA" }],
  openGraph: {
    title: "AEGIS ARENA — Autonomous Cyber Warfare Sandbox",
    description:
      "Red Team vs Blue Team con agentes de IA en evolución continua.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
