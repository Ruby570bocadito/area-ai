'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  FileJson,
  FileSpreadsheet,
  FileWarning,
  Radio,
  Swords,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, exportFilename } from '@/lib/text'
import { downloadBlob } from '@/lib/download'
import { buildEventsCsv, buildEventsJson } from '@/lib/event-export'
import { useArena } from '@/components/arena/shell/arena-provider'
import { ArenaGate, PageContainer } from '@/components/arena/shell/page-frame'
import { PageHeader } from '@/components/arena/shell/page-frame'
import { ArenaLive } from '@/components/arena/arena-live'
import { RoundEvolution, ScenarioSiblings } from '@/components/arena/campaign-analysis'
import type { CampaignDetailResponse } from '@/lib/api-types'

// ─────────────────────────────────────────────────────────────
// /historial/[id] — Ficha completa de cualquier campaña del
// archivo: telemetría íntegra (mapa, comandos reales, evidencia
// HTTP), resultado, lecciones que archivó esta campaña, la
// evolución ronda a ronda y la comparativa con las demás
// campañas del mismo escenario.
// ─────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  TACTICA: 'Táctica',
  TECNICA: 'Técnica',
  DEFENSA: 'Defensa',
  VULNERABILIDAD: 'Vulnerabilidad',
  LECCION: 'Lección',
  INTELIGENCIA: 'Inteligencia',
}

function DetailPage() {
  const { state } = useArena()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [detail, setDetail] = useState<CampaignDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/campaigns/${id}`, { cache: 'no-store' })
      const data = (await res.json()) as CampaignDetailResponse
      if (!res.ok || !data.ok) throw new Error(data.error || 'Campaña no encontrada')
      setDetail(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <PageContainer>
        <div className="panel flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#e4e7ec] bg-[#f2f4f7]">
            <FileWarning className="h-5 w-5 text-ink-500" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Campaña no encontrada</h2>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-500">
              No se pudo cargar la ficha de esta campaña ({error}). Puede que el identificador sea
              incorrecto o que la campaña se haya eliminado del archivo.
            </p>
          </div>
          <Link
            href="/historial"
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#182230]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al historial
          </Link>
        </div>
      </PageContainer>
    )
  }

  if (!detail) {
    return (
      <PageContainer>
        <div className="flex min-h-[50vh] items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#e4e7ec] bg-white shadow-sm"
          >
            <Swords className="h-6 w-6 text-ink-500" />
          </motion.div>
        </div>
      </PageContainer>
    )
  }

  const { campaign } = detail
  const isRunning = campaign.status === 'RUNNING'
  // Misma fuente de formato de duración que el informe agregado
  // (src/lib/text.ts): una campaña de 2 h se muestra "2h 00m" aquí
  // y en el informe, no "120m 0s".
  const durationLabel = campaign.endedAt
    ? formatDuration(new Date(campaign.endedAt).getTime() - new Date(campaign.startedAt).getTime())
    : isRunning
      ? 'En curso'
      : '—'

  // ── Exportación de la telemetría (implementaciones-13, backlog #2
  // de la ronda anterior): la ficha mostraba la telemetría íntegra
  // pero no permitía llevársela. La generación vive en
  // src/lib/event-export.ts (módulo puro testeado); aquí solo el
  // transporte (downloadBlob/exportFilename, fuentes únicas). El
  // prefijo incluye el codename para que el fichero se identifique
  // sin abrirlo; SIN endpoint nuevo — los datos ya están cargados.
  const hasEvents = detail.events.length > 0
  const telemetryPrefix = `telemetria-${campaign.scenario.codename.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const handleExportEventsCsv = () => {
    if (!hasEvents) return
    downloadBlob(
      buildEventsCsv(detail.events),
      'text/csv;charset=utf-8',
      exportFilename(telemetryPrefix, 'csv')
    )
  }
  const handleExportEventsJson = () => {
    if (!hasEvents) return
    downloadBlob(
      buildEventsJson(detail),
      'application/json;charset=utf-8',
      exportFilename(telemetryPrefix, 'json')
    )
  }

  return (
    <PageContainer>
      <PageHeader
        kicker={
          <Link
            href="/historial"
            className="flex items-center gap-1.5 font-mono-tight text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-400 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="h-3 w-3" /> Archivo / Detalle
          </Link>
        }
        title={`Campaña ${campaign.scenario.codename}`}
        subtitle={`${campaign.scenario.company} · ${campaign.scenario.industry}. Ficha completa con el registro íntegro de acciones, comandos reales contra el laboratorio, evidencia HTTP y las lecciones que archivó esta campaña en la memoria del sistema.`}
      />

      {/* Exportación de la telemetría (mismo dialecto que las otras
          exportaciones del producto: BOM UTF-8, «;», RFC 4180). */}
      {hasEvents && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportEventsCsv}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900"
            title={`Descargar los ${detail.events.length} eventos de la campaña en CSV — mismo dialecto que las demás exportaciones: BOM UTF-8, separador «;», escapado RFC 4180 (seq, ronda, fase, equipo, agente, acción, resultado, impacto, severidad, nodo, comando y detalle)`}
          >
            <FileSpreadsheet className="h-3 w-3" /> CSV
          </button>
          <button
            type="button"
            onClick={handleExportEventsJson}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 font-mono-tight text-[10px] font-bold text-ink-500 shadow-sm transition-colors hover:border-[#d0d5dd] hover:text-ink-900"
            title={`Descargar la telemetría en JSON con metadatos de la campaña: ganador, progresos, modo del motor, objetivos del escenario y los ${detail.events.length} eventos íntegros (evidencia y comandos incluidos)`}
          >
            <FileJson className="h-3 w-3" /> JSON
          </button>
        </div>
      )}

      {isRunning && (
        <Link
          href="/arena"
          className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#fec84b] bg-[#fffaeb] px-4 py-3 text-[12.5px] text-[#b54708] transition-colors hover:bg-[#fff7e0]"
        >
          <Radio className="h-4 w-4 shrink-0" />
          <span>
            Esta campaña está <b>en curso</b> — la telemetría en directo (mapa animado, operadores en
            turno y feed en vivo) está en la página de Operaciones. Esta ficha muestra el estado
            registrado hasta este momento.
          </span>
        </Link>
      )}

      {/* Modo del motor + resumen de eventos y lecciones */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Modo del motor', value: campaign.engineMode === 'LLM' ? 'LLM' : 'Determinista' },
          { label: 'Eventos registrados', value: String(detail.events.length) },
          { label: 'Lecciones archivadas', value: String(detail.knowledge.length) },
          { label: 'Duración', value: durationLabel },
        ].map((m) => (
          <div key={m.label} className="panel rounded-xl px-3.5 py-3">
            <p className="font-mono-tight text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
              {m.label}
            </p>
            <p className="mt-1 font-mono-tight text-[15px] font-bold text-ink-900">{m.value}</p>
          </div>
        ))}
      </div>

      <ArenaLive
        campaign={campaign}
        events={detail.events}
        agents={state?.agents ?? []}
        infraNodes={detail.infra?.nodes ?? []}
        running={isRunning}
      />

      {/* Evolución ronda a ronda (backlog 14h39 #4) + comparativa del escenario */}
      <RoundEvolution events={detail.events} maxRounds={campaign.maxRounds} />
      <ScenarioSiblings current={campaign} siblings={detail.siblings ?? []} />

      {/* Lecciones que archivó esta campaña */}
      <section className="mt-4">
        <div className="mb-2.5 flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-ink-500" />
          <h3 className="font-mono-tight text-[11px] font-bold uppercase tracking-[0.2em] text-[#475467]">
            Memoria archivada por esta campaña
          </h3>
          <span className="rounded-full border border-[#e4e7ec] bg-white px-2 py-0.5 font-mono-tight text-[9.5px] font-bold text-ink-500">
            {detail.knowledge.length}
          </span>
        </div>
        {detail.knowledge.length === 0 ? (
          <p className="panel rounded-xl px-4 py-5 text-center text-[12.5px] text-ink-500">
            Esta campaña no archivó lecciones nuevas en la memoria del sistema.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detail.knowledge.map((k) => (
              <article key={k.id} className="panel panel-hover rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono-tight text-[9px] font-bold uppercase tracking-wider',
                      k.team === 'RED' ? 'bg-[#fef3f2] text-[#b42318]' : 'bg-[#f0f9ff] text-[#026aa2]'
                    )}
                  >
                    {CATEGORY_LABEL[k.category] ?? k.category}
                  </span>
                  {k.agentCodename && (
                    <span className="font-mono-tight text-[9.5px] text-ink-400">{k.agentCodename}</span>
                  )}
                </div>
                <h4 className="mt-2 text-[13px] font-semibold leading-snug text-ink-900">{k.title}</h4>
                <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-500">{k.content}</p>
                <div className="mt-3 flex items-center justify-between font-mono-tight text-[10px] text-ink-500">
                  <span>
                    Confianza {Math.round(k.confidence * 100)}% · {k.timesUsed} usos
                  </span>
                  <Building2 className="h-3 w-3 text-[#d0d5dd]" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  )
}

export default function CampaignDetail() {
  return (
    <ArenaGate>
      <DetailPage />
    </ArenaGate>
  )
}
