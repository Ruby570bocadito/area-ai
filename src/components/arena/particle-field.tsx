'use client'

import { useMemo } from 'react'
import { Particles, ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions, Engine } from '@tsparticles/engine'

// ─────────────────────────────────────────────────────────────
// Campo de partículas contenido y elegante — tsParticles v3
// (https://github.com/tsparticles/tsparticles)
// Pocas partículas, enlaces tenues: textura, no espectáculo.
// ─────────────────────────────────────────────────────────────

async function initEngine(engine: Engine) {
  await loadSlim(engine)
}

export function ParticleField({ id = 'area-particles' }: { id?: string }) {
  const options = useMemo<ISourceOptions>(
    () => ({
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: 34, density: { enable: true, width: 1400, height: 900 } },
        color: {
          value: ['#f4536e', '#41c0ef', '#8b93a5'],
        },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.12, max: 0.38 },
          animation: { enable: true, speed: 0.4, sync: false },
        },
        size: { value: { min: 1, max: 2.2 } },
        links: {
          enable: true,
          distance: 150,
          color: '#6b7689',
          opacity: 0.09,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.4,
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
          grab: { distance: 160, links: { opacity: 0.18 } },
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
