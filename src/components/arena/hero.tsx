'use client'

import { motion } from 'framer-motion'
import { BrainCircuit, ShieldCheck, Swords, Trophy, Database, Activity } from 'lucide-react'
import { ParticleBackground } from './particle-bg'
import type { StateResponse } from '@/lib/api-types'

function StatChip({
  icon,
  label,
  value,
  tone = 'default',
  delay = 0,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  tone?: 'default' | 'red' | 'cyan' | 'violet'
  delay?: number
}) {
  const toneCls = {
    default: 'text-foreground',
    red: 'text-[#ff6b85]',
    cyan: 'text-[#67e8f9]',
    violet: 'text-[#c4a5ff]',
  }[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
    >
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className={`font-mono-tight text-lg font-black leading-none ${toneCls}`}>{value}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  )
}

export function Hero({ stats, provider }: { stats: StateResponse['stats']; provider: string }) {
  return (
    <header className="relative overflow-hidden">
      <ParticleBackground density={55} />
      <div className="grid-bg absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          <span className="mb-4 flex items-center gap-2 rounded-full border border-[#1c2b4a] bg-black/50 px-4 py-1.5 font-mono-tight text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee] anim-blink" />
            Sandbox autónomo de ciberseguridad · Motor {provider}
          </span>
          <h1 className="anim-glitch font-mono-tight text-4xl font-black tracking-tight sm:text-6xl">
            <span className="anim-shimmer">AEGIS ARENA</span>
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
            Agentes de IA del <span className="font-semibold text-[#ff6b85]">Red Team</span> y del{' '}
            <span className="font-semibold text-[#67e8f9]">Blue Team</span> libran campañas continuas sobre
            infraestructuras empresariales simuladas. Cada combate genera conocimiento que se archiva, se
            reutiliza y hace evolucionar a ambos equipos — <span className="text-foreground/80">una máquina de guerra cibernética que aprende de sí misma.</span>
          </p>
        </motion.div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <StatChip icon={<Swords className="h-4 w-4" />} label="Campañas" value={stats.totalCampaigns} tone="violet" delay={0.1} />
          <StatChip icon={<Trophy className="h-4 w-4" />} label="Victorias RED" value={stats.redWins} tone="red" delay={0.18} />
          <StatChip icon={<ShieldCheck className="h-4 w-4" />} label="Victorias BLUE" value={stats.blueWins} tone="cyan" delay={0.26} />
          <StatChip icon={<Database className="h-4 w-4" />} label="Conocimiento" value={stats.knowledgeCount} delay={0.34} />
          <StatChip icon={<BrainCircuit className="h-4 w-4" />} label="Evolución RED" value={`${stats.evolutionRed}%`} tone="red" delay={0.42} />
          <StatChip icon={<Activity className="h-4 w-4" />} label="Evolución BLUE" value={`${stats.evolutionBlue}%`} tone="cyan" delay={0.5} />
        </div>
      </div>
    </header>
  )
}
