import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "AEGIS ARENA — Sandbox de Autoevolución Red vs Blue con IA",
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
    title: "AEGIS ARENA",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
