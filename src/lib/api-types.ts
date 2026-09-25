// ─────────────────────────────────────────────────────────────
// Tipos del cliente para /api/state
// ─────────────────────────────────────────────────────────────

export interface AgentDTO {
  id: string
  key: string
  codename: string
  team: 'RED' | 'BLUE'
  role: string
  specialty: string
  icon: string
  description: string
  xp: number
  level: number
  campaigns: number
  victories: number
}

export interface ScenarioDTO {
  id: string
  key: string
  codename: string
  company: string
  industry: string
  difficulty: number
  description: string
  redObjective: string
  blueObjective: string
}

export interface CampaignSummaryDTO {
  id: string
  status: string
  phase: string
  round: number
  maxRounds: number
  redProgress: number
  blueProgress: number
  redScore: number
  blueScore: number
  winner: string | null
  narrative: string | null
  startedAt: string
  endedAt: string | null
  scenario: {
    key: string
    codename: string
    company: string
    industry: string
    difficulty: number
    redObjective: string
    blueObjective: string
  }
}

export interface CampaignListItemDTO {
  id: string
  status: string
  winner: string | null
  redProgress: number
  blueProgress: number
  redScore: number
  blueScore: number
  startedAt: string
  endedAt: string | null
  scenario: { codename: string; company: string; industry: string; difficulty: number }
}

export interface EventDTO {
  id: string
  seq: number
  round: number
  phase: string
  team: 'RED' | 'BLUE' | 'SYSTEM'
  agentKey: string | null
  agentCodename: string | null
  action: string
  detail: string
  result: string | null
  impact: number
  severity: string
  targetNode: string | null
  createdAt: string
}

export interface InfraNodeDTO {
  id: string
  name: string
  type: string
  ip: string
  segment: string
  criticality: number
  vulnerabilities: string[]
  controls: string[]
}

export interface KnowledgeDTO {
  id: string
  team: 'RED' | 'BLUE'
  campaignId: string | null
  agentCodename: string | null
  category: string
  title: string
  content: string
  tags: string
  confidence: number
  timesUsed: number
  timesWorked: number
  createdAt: string
}

export interface StateResponse {
  ok: boolean
  provider: string
  autopilot: boolean
  agents: AgentDTO[]
  scenarios: ScenarioDTO[]
  campaigns: CampaignListItemDTO[]
  activeCampaign: { id: string } | null
  liveCampaign: CampaignSummaryDTO | null
  liveEvents: EventDTO[]
  liveInfra: { nodes: InfraNodeDTO[] } | null
  knowledge: { red: KnowledgeDTO[]; blue: KnowledgeDTO[] }
  stats: {
    totalCampaigns: number
    running: number
    redWins: number
    blueWins: number
    draws: number
    knowledgeCount: number
    evolutionRed: number
    evolutionBlue: number
  }
}
