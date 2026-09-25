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
  command: string | null
  evidence: string | null
  createdAt: string
}

export interface RecentActivityDTO {
  id: string
  team: 'RED' | 'BLUE'
  agentCodename: string | null
  action: string
  result: string | null
  phase: string
  impact: number
  campaignCodename: string
  createdAt: string
}

export interface LabNodeInfoDTO {
  nodeId: string
  segment: string
  criticality: number
  compromised: boolean
  isolated: boolean
  vulnerabilities: Array<{ name: string; status: 'OPEN' | 'PATCHED' }>
  sessions: number
}

export interface LiveLabDTO {
  campaignId: string
  scenarioKey: string
  company: string
  round: number
  nodes: LabNodeInfoDTO[]
  sessions: number
  monitors: Array<{ segment: string; signature: string; nodeId?: string; by: string; deployedRound: number }>
  firewall: Array<{ reason: string; blockNodeId: string | null; blockSessionId: string | null; deployedRound: number; by: string }>
  exfiltrated: Array<{ table: string; bytes: number; at: string }>
  exchanges: number
  lastExchanges: Array<{ nodeId: string; method: string; path: string; status: number; ms: number; team: string; signature: string | null }>
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

export interface CampaignDetailResponse {
  ok: boolean
  error?: string
  campaign: CampaignSummaryDTO & { engineMode: string }
  events: EventDTO[]
  knowledge: KnowledgeDTO[]
  infra: { nodes: InfraNodeDTO[] } | null
}

export interface CampaignsListResponse {
  ok: boolean
  error?: string
  campaigns: CampaignListItemDTO[]
}

export interface KnowledgeListItemDTO extends KnowledgeDTO {
  campaignCodename: string | null
}

export interface KnowledgeListResponse {
  ok: boolean
  error?: string
  knowledge: KnowledgeListItemDTO[]
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
  liveLab: LiveLabDTO | null
  recentActivity: RecentActivityDTO[]
  knowledgeSpark: number[]
  lab: { online: boolean; port: number | null; activeCampaigns: number; exchanges: number }
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
