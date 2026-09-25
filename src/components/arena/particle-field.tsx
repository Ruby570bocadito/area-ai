'use client'

import { useMemo } from 'react'
import { Particles, ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions, Engine } from '@tsparticles/engine'

// ─────────────────────────────────────────────────────────────
// Fondo de partículas profesional basado en tsParticles v3
// (https://github.com/tsparticles/tsparticles)
// Red de nodos con paleta Red/Cyan y enlaces que conectan.
// ─────────────────────────────────────────────────────────────

async function initEngine(engine: Engine) {
  await loadSlim(engine)
}

export function ParticleField({ id = 'aegis-particles' }: { id?: string }) {
  const options = useMemo<ISourceOptions>(
    () => ({
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: 55, density: { enable: true, width: 1200, height: 800 } },
        color: {
          value: ['#ff3355', '#22d3ee', '#8b9dff'],
        },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.25, max: 0.65 },
          animation: { enable: true, speed: 0.6, sync: false },
        },
        size: { value: { min: 1, max: 2.6 } },
        links: {
          enable: true,
          distance: 130,
          color: '#3b6ea8',
          opacity: 0.16,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.55,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' },
        },
      },
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
          resize: { enable: true },
        },
        modes: {
          grab: { distance: 150, links: { opacity: 0.3 } },
        },
      },
    }),
    []
  )

  return (
    <ParticlesProvider init={initEngine}>
      <Particles
        id={id}
        className="pointer-events-none absolute inset-0 z-0"
        options={options}
      />
    </ParticlesProvider>
  )
}
