/**
 * Transporte de descargas al usuario — utilidad de CLIENTE única para
 * los tres exportadores de la app (campañas e informe agregado en
 * history-panel.tsx, conocimiento en knowledge-panel.tsx y telemetría
 * de eventos en la ficha /historial/[id]).
 *
 * El patrón (Blob + object URL + clic programático) vivía duplicado
 * en dos componentes; la ronda implementaciones-13 lo eleva a utilidad
 * compartida para que la ficha no replique una tercera copia (mismo
 * dedupe que exportFilename en text.ts, backlog #5 de la ronda
 * anterior). Vive en fichero propio y NO dentro de text.ts porque
 * text.ts es un módulo puro sin DOM — esta utilidad exige navegador
 * (document/URL), así que solo se importa desde componentes cliente.
 */
export function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Copia texto al portapapeles con doble vía: Clipboard API (contexto
 * seguro) y fallback heredado con textarea + execCommand (contextos
 * no seguros o permisos restringidos). Devuelve false solo si ambas
 * vías fallan, para que el llamante pueda degradar con honestidad
 * (aviso, descarga alternativa…) y el usuario no pierda el texto.
 *
 * Misma casa que downloadBlob: transporte de cliente en fichero
 * propio, sin DOM en módulos puros. La copia ESPECIALIZADA del
 * informe agregado (degrada a DESCARGA del informe) sigue en
 * history-panel.tsx — su fallback no es portapapeles sino exportación.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // sigue al fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
