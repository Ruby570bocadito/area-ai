import { db } from '@/lib/db'
import { RED_AGENTS, BLUE_AGENTS, SCENARIOS } from './roster'

// ─────────────────────────────────────────────────────────────
// Seed idempotente: agentes, escenarios y conocimiento fundacional
// ─────────────────────────────────────────────────────────────

const INITIAL_KNOWLEDGE = [
  {
    team: 'RED',
    category: 'TACTICA',
    title: 'El reconocimiento pasivo precede a todo ataque',
    content:
      'Antes de tocar la víctima, mapear superficie expuesta desde fuentes públicas (certificados TLS, DNS, repositorios filtrados). Los escaneos agresivos tempranos disparan alertas del SOC y queman el acceso.',
    tags: 'recon,osint,stealth',
    confidence: 0.55,
  },
  {
    team: 'RED',
    category: 'TECNICA',
    title: 'Perímetro: buscar gadgets desactualizados',
    content:
      'La intrusión inicial más fiable suele ser un CMS, VPN o portal web con componentes desactualizados. Identificar versiones exactas en la fase RECON eleva la tasa de éxito de la explotación.',
    tags: 'intrusion,explotacion,perimetro',
    confidence: 0.5,
  },
  {
    team: 'RED',
    category: 'LECCION',
    title: 'El ruido en escalada revela la campaña',
    content:
      'Abusar de credenciales con muchos intentos fallidos genera bloqueos y alertas. Preferir robo de tokens/hashes en memoria y usar credenciales limpias una sola vez.',
    tags: 'escalada,credenciales,opsec',
    confidence: 0.5,
  },
  {
    team: 'BLUE',
    category: 'DEFENSA',
    title: 'Visibilidad antes que prevención',
    content:
      'No se puede defender lo que no se ve. Integrar logs de firewall, VPN y servidores en el SIEM con retención mínima de 90 días permite detectar reconocimiento antes de la intrusión.',
    tags: 'siem,visibilidad,logging',
    confidence: 0.55,
  },
  {
    team: 'BLUE',
    category: 'DEFENSA',
    title: 'MFA y parcheo de perímetro = 80% del riesgo',
    content:
      'La mayoría de intrusiones arrancan en servicios de borde sin MFA o con software desactualizado. Priorizar MFA en accesos remotos y un ciclo de parcheo semanal de activos expuestos.',
    tags: 'mfa,parcheo,perimetro',
    confidence: 0.55,
  },
  {
    team: 'BLUE',
    category: 'LECCION',
    title: 'La segmentación frena el movimiento lateral',
    content:
      'Un atacante con acceso a un endpoint no debería alcanzar la base de datos crítica. VLANs por función, reglas de denegación por defecto y jump hosts controlados reducen el radio de explosión.',
    tags: 'segmentacion,lateral,arquitectura',
    confidence: 0.5,
  },
]

let seedPromise: Promise<void> | null = null

async function doSeed(): Promise<void> {
  // Agentes
  const agentCount = await db.agent.count()
  if (agentCount === 0) {
    const all = [...RED_AGENTS, ...BLUE_AGENTS]
    for (const { phases: _phases, ...agent } of all) {
      await db.agent.create({ data: agent })
    }
  }

  // Escenarios
  const scenarioCount = await db.scenario.count()
  if (scenarioCount === 0) {
    for (const s of SCENARIOS) {
      await db.scenario.create({
        data: {
          key: s.key,
          codename: s.codename,
          company: s.company,
          industry: s.industry,
          difficulty: s.difficulty,
          description: s.description,
          infrastructure: JSON.stringify(s.infrastructure),
          redObjective: s.redObjective,
          blueObjective: s.blueObjective,
        },
      })
    }
  }

  // Conocimiento fundacional (solo si no hay ninguno)
  const knCount = await db.knowledge.count()
  if (knCount === 0) {
    for (const k of INITIAL_KNOWLEDGE) {
      await db.knowledge.create({ data: k })
    }
  }
}

export async function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      seedPromise = null
      throw err
    })
  }
  return seedPromise
}
