# claim barra-estado-sistema

- Agente: IMP-2
- Fecha: 2026-10-23
- Alcance: indicador permanente de salud del sistema (BD, lab, proveedor LLM, modo determinista) en el shell; zona frontend src/components/arena/shell/.
- Toque compartido: `src/lib/api-types.ts` — campo OPCIONAL y aditivo `engineMode?: string` en CampaignSummaryDTO (el motor ya lo persiste y lo sirve en /api/state; solo se tipa). Sin cambios de forma en campos existentes.
