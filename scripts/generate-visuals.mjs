import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

// Estilo común de la serie: dark cinematic, marca rojo/cian sobre negro
const STYLE =
  'dark cinematic 3D render, near-black background color #08090d, crimson red #f4536e and cyan #41c0ef neon accent lighting, volumetric fog, high contrast, premium cybersecurity concept art, highly detailed, no text, no words, no letters, no watermark'

const IMAGES = [
  {
    name: 'scenario-novaretail.png',
    size: '1344x768',
    prompt:
      'futuristic e-commerce fulfillment datacenter at night, endless rows of server racks, holographic shopping cart and parcel package icons floating between racks, robotic package conveyor belts',
  },
  {
    name: 'scenario-hospital-vitalis.png',
    size: '1344x768',
    prompt:
      'futuristic hospital server room with a large glowing medical cross hologram, patient monitor screens and ICU life-support systems, ambulance silhouette outside glass wall',
  },
  {
    name: 'scenario-technova-saas.png',
    size: '1344x768',
    prompt:
      'floating isometric cloud computing infrastructure, clusters of server blocks connected by glowing light beams, kubernetes node grid hologram, orbiting satellite uplinks',
  },
  {
    name: 'scenario-fincorp-bank.png',
    size: '1344x768',
    prompt:
      'high-security bank vault datacenter, massive circular vault door with golden amber rim light, holographic financial candlestick charts floating, biometric scanners and secure terminals',
  },
  {
    name: 'scenario-enermax-grid.png',
    size: '1344x768',
    prompt:
      'industrial SCADA control room of an electric power grid, giant glowing turbine and power pylon holograms, energy flow lines across a dark map of the grid, control desks with warning screens',
  },
  {
    name: 'scenario-aerodefense-labs.png',
    size: '1344x768',
    prompt:
      'aerospace defense operations war room, radar dome and satellite hologram over a large glowing world map, target trajectory arcs, stealth fighter silhouette on the runway outside the window',
  },
  {
    name: 'og.png',
    size: '1440x704',
    prompt:
      'abstract technology banner, two opposing streams of light colliding at the center forming a hexagon, left stream crimson red right stream cyan, hexagonal grid pattern faint in background, minimalist premium AI laboratory aesthetic',
  },
]

const OUT_DIR = '/home/z/my-project/public'

async function main() {
  const zai = await ZAI.create()
  const results = []
  for (const img of IMAGES) {
    const outPath = path.join(OUT_DIR, img.name)
    if (fs.existsSync(outPath) && process.env.SKIP_EXISTING === '1') {
      console.log(`↷ ya existe: ${img.name}`)
      continue
    }
    let ok = false
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await zai.images.generations.create({
          prompt: `${img.prompt}, ${STYLE}`,
          size: img.size,
        })
        const b64 = res?.data?.[0]?.base64
        if (!b64) throw new Error('respuesta sin base64')
        fs.writeFileSync(outPath, Buffer.from(b64, 'base64'))
        const kb = Math.round(fs.statSync(outPath).size / 1024)
        console.log(`✓ ${img.name} (${kb} KB)`)
        ok = true
      } catch (e) {
        console.error(`✗ intento ${attempt} ${img.name}: ${e.message}`)
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
    results.push({ name: img.name, ok })
  }
  const failed = results.filter((r) => !r.ok)
  console.log(failed.length === 0 ? 'TODAS OK' : `FALLARON: ${failed.map((f) => f.name).join(', ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
