import type { Infrastructure, InfraNode } from '@/lib/sim/types'
import { LabCampaignState, LabNodeState } from './types'

// ─────────────────────────────────────────────────────────────
// LAB REAL — Registro de estados de laboratorio por campaña.
// Vive en globalThis para sobrevivir al HMR y a varios módulos.
// ─────────────────────────────────────────────────────────────

interface LabRegistry {
  labs: Map<string, LabCampaignState>
  port?: number
  bootedAt?: string
}

const g = globalThis as unknown as { __areaLab?: LabRegistry }

function registry(): LabRegistry {
  if (!g.__areaLab) {
    g.__areaLab = { labs: new Map(), bootedAt: new Date().toISOString() }
  }
  return g.__areaLab
}

export function getLab(campaignId: string): LabCampaignState | undefined {
  return registry().labs.get(campaignId)
}

export function labInfo() {
  const r = registry()
  const labs = [...r.labs.values()]
  return {
    online: labs.length > 0,
    port: r.port ?? null,
    bootedAt: r.bootedAt ?? null,
    activeCampaigns: labs.length,
    exchanges: labs.reduce((s, l) => s + l.journal.length, 0),
    campaigns: labs.map((l) => ({
      campaignId: l.campaignId,
      scenarioKey: l.scenarioKey,
      company: l.company,
      round: l.round,
      nodes: [...l.nodes.values()].map((n) => ({
        nodeId: n.nodeId,
        segment: n.segment,
        criticality: n.criticality,
        compromised: n.compromised,
        isolated: n.isolated,
        vulnerabilities: Object.entries(n.vulnerabilities).map(([name, status]) => ({ name, status })),
        sessions: [...l.sessions.values()].filter((s) => s.homeNodeId === n.nodeId && !s.revoked && s.team === 'RED').length,
      })),
      sessions: [...l.sessions.values()].filter((s) => !s.revoked).length,
      monitors: l.monitors.map((m) => ({ segment: m.segment, signature: m.signature, nodeId: m.nodeId, by: m.by, deployedRound: m.deployedRound })),
      firewall: l.firewall.map((f) => ({ reason: f.reason, blockNodeId: f.blockNodeId ?? null, blockSessionId: f.blockSessionId ?? null, deployedRound: f.deployedRound, by: f.by })),
      exfiltrated: l.exfiltrated.slice(-6),
      exchanges: l.journal.length,
      lastExchanges: l.journal.slice(-8).map((e) => ({
        nodeId: e.nodeId,
        method: e.method,
        path: e.path,
        status: e.status,
        ms: e.ms,
        team: e.team,
        signature: e.signature ?? null,
      })),
    })),
  }
}

export function recordLabPort(port: number) {
  registry().port = port
}

export function cleanupLab(campaignId: string) {
  registry().labs.delete(campaignId)
}

/** Arranca el estado de laboratorio de una campaña desde la infraestructura del escenario */
export function bootLab(
  campaignId: string,
  scenario: { key: string; company: string },
  infra: Infrastructure,
  round = 1
): LabCampaignState {
  const r = registry()
  const nodes = new Map<string, LabNodeState>()
  for (const n of infra.nodes as InfraNode[]) {
    nodes.set(n.id, {
      nodeId: n.id,
      segment: n.segment,
      type: n.type,
      criticality: n.criticality,
      vulnerabilities: Object.fromEntries(n.vulnerabilities.map((v) => [v, 'OPEN' as const])),
      controls: n.controls,
      compromised: false,
      isolated: false,
      patchesApplied: [],
    })
  }
  const lab: LabCampaignState = {
    campaignId,
    scenarioKey: scenario.key,
    company: scenario.company,
    bootedAt: new Date().toISOString(),
    round,
    nodes,
    sessions: new Map(),
    journal: [],
    monitors: [],
    firewall: [],
    exfiltrated: [],
    seq: 0,
  }
  r.labs.set(campaignId, lab)
  return lab
}

export function setLabRound(campaignId: string, round: number) {
  const lab = getLab(campaignId)
  if (lab) lab.round = round
}
