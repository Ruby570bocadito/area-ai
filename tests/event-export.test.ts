import { describe, expect, test } from 'bun:test'
import { EVENTS_CSV_HEADERS, buildEventsCsv, buildEventsJson } from '../src/lib/event-export'
import type { CampaignDetailResponse, EventDTO } from '../src/lib/api-types'

// ─────────────────────────────────────────────────────────────
// Contrato del exportador de telemetría de eventos (ficha de
// campaña): mismo dialecto CSV que las otras dos exportaciones
// (BOM UTF-8 + «;» + RFC 4180 vía csvEscapeCell) y JSON íntegro
// con metadatos de campaña.
// ─────────────────────────────────────────────────────────────

function event(overrides: Partial<EventDTO> = {}): EventDTO {
  return {
    id: 'ev-1',
    seq: 0,
    round: 1,
    phase: 'RECON',
    team: 'RED',
    agentKey: 'red-recon',
    agentCodename: 'Sombra',
    action: 'Escaneo de puertos',
    detail: 'Barre nmap del segmento DMZ',
    result: 'EXITO',
    impact: 4,
    severity: 'LOW',
    targetNode: 'web-01',
    command: 'nmap -sV 10.0.0.1',
    evidence: '{"exchanges":[],"artifacts":[]}',
    createdAt: '2026-09-25T21:00:05.000Z',
    ...overrides,
  }
}

function detail(overrides: Partial<CampaignDetailResponse> = {}, events: EventDTO[] = [event()]): CampaignDetailResponse {
  return {
    ok: true,
    campaign: {
      id: 'cm-test',
      status: 'COMPLETED',
      phase: 'OBJETIVO',
      round: 12,
      maxRounds: 12,
      redProgress: 78,
      blueProgress: 64,
      redScore: 96,
      blueScore: 70,
      winner: 'RED',
      narrative: 'El RED prevaleció tras doble pivote.',
      engineMode: 'SIM',
      startedAt: '2026-09-25T21:00:00.000Z',
      endedAt: '2026-09-25T21:07:00.000Z',
      scenario: {
        key: 'fincorp-bank',
        codename: 'FINCORP-BANK',
        company: 'FinCorp Bank',
        industry: 'Banca',
        difficulty: 4,
        redObjective: 'Exfiltrar el ledger.',
        blueObjective: 'Contener el acceso.',
      },
    },
    events,
    knowledge: [],
    siblings: [],
    infra: null,
    ...overrides,
  }
}

describe('CSV de telemetría (buildEventsCsv)', () => {
  test('BOM UTF-8 + cabecera exacta con separador «;»', () => {
    const csv = buildEventsCsv([])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const header = csv.slice(1)
    expect(header).toBe(EVENTS_CSV_HEADERS.join(';'))
  })

  test('orden de campos: seq, ronda, fase, equipo, agente, acción, resultado, impacto, severidad, nodo, comando, detalle', () => {
    const csv = buildEventsCsv([event()])
    const rows = csv.slice(1).split('\n')
    expect(rows.length).toBe(2)
    expect(rows[1]).toBe('0;1;RECON;RED;Sombra;Escaneo de puertos;EXITO;4;LOW;web-01;nmap -sV 10.0.0.1;Barre nmap del segmento DMZ')
  })

  test('escapado RFC 4180: «;», comillas dobladas y saltos dentro de la celda', () => {
    const csv = buildEventsCsv([
      event({ detail: 'Detalle con "comillas" y ;punto y coma;\ny salto' }),
    ])
    // La celda con salto interno queda entrecomillada — se coteja contra
    // el CSV completo porque el salto de la celda parte las líneas
    // físicas (RFC 4180: el salto entrecomillado no termina la fila).
    expect(csv).toContain('"Detalle con ""comillas"" y ;punto y coma;\ny salto"')
  })

  test('evento SYSTEM sin agente y sin resultado: celdas vacías, no «undefined»', () => {
    const csv = buildEventsCsv([
      event({ team: 'SYSTEM', agentKey: null, agentCodename: null, result: null, command: null, targetNode: null, impact: 0, severity: 'INFO', action: 'Campaña iniciada', detail: 'Laboratorio desplegado.' }),
    ])
    const rows = csv.slice(1).split('\n')
    expect(rows[1]).toBe('0;1;RECON;SYSTEM;;Campaña iniciada;;0;INFO;;;Laboratorio desplegado.')
  })

  test('la fila SYSTEM de arranque queda incluida con su detalle real', () => {
    const csv = buildEventsCsv([
      event({ team: 'SYSTEM', agentCodename: null, action: 'Campaña FINCORP-BANK iniciada', detail: 'Laboratorio REAL desplegado: 8 servicios HTTP.' }),
    ])
    expect(csv).toContain('SYSTEM')
    expect(csv).toContain('Laboratorio REAL desplegado')
  })

  test('varios eventos conservan el orden dado (seq ascendente de la ficha)', () => {
    const csv = buildEventsCsv([event({ seq: 0, action: 'primero' }), event({ seq: 1, action: 'segundo' }), event({ seq: 2, action: 'tercero' })])
    const body = csv.slice(1).split('\n').slice(1)
    expect(body.length).toBe(3)
    expect(body[0]).toContain('primero')
    expect(body[2]).toContain('tercero')
  })
})

describe('JSON de telemetría (buildEventsJson)', () => {
  test('metadatos: exportedAt ISO-8601, ok y total coherentes', () => {
    const now = new Date('2026-09-25T21:30:00.000Z')
    const parsed = JSON.parse(buildEventsJson(detail(), now))
    expect(parsed.ok).toBe(true)
    expect(parsed.exportedAt).toBe('2026-09-25T21:30:00.000Z')
    expect(parsed.total).toBe(1)
  })

  test('bloque campaign: identificadores del escenario subidos y cifras del combate', () => {
    const parsed = JSON.parse(buildEventsJson(detail()))
    expect(parsed.campaign.codename).toBe('FINCORP-BANK')
    expect(parsed.campaign.company).toBe('FinCorp Bank')
    expect(parsed.campaign.difficulty).toBe(4)
    expect(parsed.campaign.redObjective).toBe('Exfiltrar el ledger.')
    expect(parsed.campaign.winner).toBe('RED')
    expect(parsed.campaign.redProgress).toBe(78)
    expect(parsed.campaign.blueProgress).toBe(64)
    expect(parsed.campaign.maxRounds).toBe(12)
    expect(parsed.campaign.engineMode).toBe('SIM')
  })

  test('fechas legibles precalculadas y nulos degradados', () => {
    const parsed = JSON.parse(buildEventsJson(detail()))
    // Mismo contrato de formato que formatDateTime (locale es-ES).
    expect(parsed.campaign.startedAtLabel).toBe(new Date('2026-09-25T21:00:00.000Z').toLocaleString('es-ES'))
    expect(parsed.campaign.endedAtLabel).toContain('21:07')
    const noEnd = detail({ campaign: { ...detail().campaign, endedAt: null } })
    const parsed2 = JSON.parse(buildEventsJson(noEnd))
    expect(parsed2.campaign.endedAtLabel).toBe('')
    expect(parsed2.campaign.endedAt).toBeNull()
  })

  test('eventos íntegros: evidencia y comando conservados tal cual', () => {
    const parsed = JSON.parse(buildEventsJson(detail()))
    expect(parsed.events.length).toBe(1)
    expect(parsed.events[0].command).toBe('nmap -sV 10.0.0.1')
    expect(parsed.events[0].evidence).toBe('{"exchanges":[],"artifacts":[]}')
    expect(parsed.events[0].agentCodename).toBe('Sombra')
  })

  test('campaña sin eventos: total 0 y lista vacía (coherente)', () => {
    const parsed = JSON.parse(buildEventsJson(detail({}, [])))
    expect(parsed.total).toBe(0)
    expect(parsed.events).toEqual([])
  })

  test('serialización con indentación 2 (legible sin herramientas)', () => {
    const json = buildEventsJson(detail())
    expect(json).toContain('\n  "ok": true')
    expect(json).toContain('\n    "id"')
  })
})
