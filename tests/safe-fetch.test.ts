// ─────────────────────────────────────────────────────────────
// Tests de regresión del fetch con pin de IP (tarea ssrf-ip-pinning)
//
// safeFetch (src/lib/net/safe-fetch.ts) es el punto de cumplimiento
// del guard SSRF: resuelve UNA vez, clasifica ese mismo lote y
// conecta a esa IP exacta. Estas pruebas son HERMÉTICAS (DNS falso
// inyectado, servidores http y TLS locales con cert autofirmado de
// tests/fixtures — clave desechable, solo para este host de prueba):
//
//   · PIN: la conexión va a la IP resuelta (el servidor local la
//     recibe) con la cabecera Host original — el lookup ocurre UNA
//     vez y una segunda resolución JAMÁS sucede (así era el TOCTOU
//     de R13: el fetch histórico re-resolvía DNS).
//   · metadata bloqueada SIEMPRE (por hostname, por DNS y por
//     literal) y política allowedKinds re-aplicada al conectar.
//   · https: SNI y verificación del certificado contra el NOMBRE
//     (proveedor.test) mientras el TCP va a 127.0.0.1 — el pin no
//     rompe TLS; chunked y content-length decodificados; tope de
//     respuesta; plazo total; 3xx sin seguir (anti-evasión).
// ─────────────────────────────────────────────────────────────

/// <reference types="bun-types" />

import { describe, expect, test, afterAll } from 'bun:test'
import * as http from 'node:http'
import * as tls from 'node:tls'
import * as net from 'node:net'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeFetch, SafeFetchError, type SafeFetchErrorCode, type SafeResponse } from '../src/lib/net/safe-fetch'
import { classifyAddresses, classifyHostname, type LookupFn } from '../src/lib/net/target-guard'

// ── helpers ────────────────────────────────────────────────────

interface RecordedRequest {
  host: string
  path: string
  body: string
  sni: string | null
}

/** Lee una petición HTTP/1.1 completa (cabeceras + body por content-length). */
function readRequest(sock: net.Socket | tls.TLSSocket): Promise<RecordedRequest> {
  return new Promise((resolve, reject) => {
    let buf: Buffer = Buffer.alloc(0)
    sock.on('error', reject)
    sock.on('data', (c: Buffer) => {
      buf = Buffer.concat([buf, c])
      const sep = buf.indexOf('\r\n\r\n')
      if (sep === -1) return
      const head = buf.subarray(0, sep).toString('utf8')
      const lines = head.split('\r\n')
      const clLine = lines.find((l) => /^content-length:/i.test(l))
      const cl = clLine ? Number(clLine.split(':')[1].trim()) : 0
      const bodyBuf = buf.subarray(sep + 4)
      if (bodyBuf.length < cl) return
      const hostLine = lines.find((l) => /^host:/i.test(l)) ?? 'host: ?'
      resolve({
        host: hostLine.replace(/^host:/i, '').trim(),
        path: lines[0].split(' ')[1] ?? '',
        body: bodyBuf.subarray(0, cl).toString('utf8'),
        sni:
          'getServername' in sock
            ? ((sock as unknown as { getServername?: () => string | null }).getServername?.() ?? null)
            : null,
      })
    })
  })
}

function writeJson(sock: net.Socket | tls.TLSSocket, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  const text = JSON.stringify(body)
  const headers = Object.entries(extraHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n')
  sock.write(
    `HTTP/1.1 ${status} Test\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(text)}\r\n${headers}\r\n\r\n${text}`
  )
}

/** Servidor HTTP local que registra la petición y delega la respuesta (API res). */
function listenHttp(handle: (res: http.ServerResponse, rec: RecordedRequest) => void) {
  const requests: RecordedRequest[] = []
  const server = http.createServer((req, res) => {
    const rec: RecordedRequest = {
      host: req.headers.host ?? '?',
      path: req.url ?? '',
      body: '',
      sni: null,
    }
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => {
      rec.body = Buffer.concat(chunks).toString('utf8')
      requests.push(rec)
      handle(res, rec)
    })
  })
  return {
    requests,
    listen: () =>
      new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const address = server.address() as net.AddressInfo
          resolve({
            port: address.port,
            close: () => new Promise<void>((done) => server.close(() => done())),
          })
        })
      }),
  }
}

/** Servidor TLS local (cert de tests/fixtures) a pelo, sin node:http. */
function listenTls(handle: (sock: tls.TLSSocket, rec: RecordedRequest) => void) {
  const requests: RecordedRequest[] = []
  const server = tls.createServer(
    {
      key: readFileSync(join(import.meta.dir, 'fixtures', 'proveedor-test.key')),
      cert: readFileSync(join(import.meta.dir, 'fixtures', 'proveedor-test.crt')),
    },
    (sock) => {
      void readRequest(sock).then((rec) => {
        requests.push(rec)
        handle(sock, rec)
      })
    }
  )
  return {
    requests,
    listen: () =>
      new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const address = server.address() as net.AddressInfo
          resolve({
            port: address.port,
            close: () => new Promise<void>((done) => server.close(() => done())),
          })
        })
      }),
  }
}

/** DNS falso con contador de resoluciones (hermético: cero red real). */
function fakeDns(routes: Record<string, string[]>) {
  let calls = 0
  const lookupFn: LookupFn = async (host: string) => {
    calls++
    const addrs = routes[host]
    if (!addrs) {
      const err = new Error(`getaddrinfo ${host} ENOTFOUND`) as Error & { code?: string }
      err.code = 'ENOTFOUND'
      throw err
    }
    return addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }
  return { lookupFn, calls: () => calls }
}

const crt = readFileSync(join(import.meta.dir, 'fixtures', 'proveedor-test.crt')).toString('utf8')

const closers: Array<() => Promise<void>> = []
afterAll(async () => {
  for (const c of closers) await c()
})

const expectSafeFetchError = async (p: Promise<SafeResponse>, code: SafeFetchErrorCode) => {
  try {
    await p
    throw new Error(`se esperaba SafeFetchError ${code} y la petición tuvo éxito`)
  } catch (e) {
    expect(e).toBeInstanceOf(SafeFetchError)
    expect((e as SafeFetchError).code).toBe(code)
  }
}

// ── clasificación compartida con el guard ──────────────────────

describe('classifyAddresses / classifyHostname — agregación compartida', () => {
  test('lote mixto público+privado → private (peor caso)', () =>
    expect(classifyAddresses([{ address: '8.8.8.8' }, { address: '192.168.1.1' }])).toBe('private'))
  test('lote público → public', () =>
    expect(classifyAddresses([{ address: '8.8.8.8' }, { address: '1.1.1.1' }])).toBe('public'))
  test('metadata en el lote → metadata (bloqueo SIEMPRE)', () =>
    expect(classifyAddresses([{ address: '8.8.8.8' }, { address: '169.254.169.254' }])).toBe('metadata'))
  test('hostname de metadata sin DNS', () => expect(classifyHostname('metadata.google.internal')).toBe('metadata'))
  test('localhost y sufijos reservados → private sin DNS', () => {
    expect(classifyHostname('localhost')).toBe('private')
    expect(classifyHostname('proveedor.internal')).toBe('private')
  })
  test('nombre real exige resolución', () => expect(classifyHostname('proveedor.test')).toBe('dns'))
})

// ── pin en http (rama fetch nativo a URL-IP) ───────────────────

describe('safeFetch http — pin de IP y Host original', () => {
  test('conecta a la IP resuelta con Host original y resuelve UNA vez', async () => {
    const s = listenHttp((res, rec) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ hola: rec.host }))
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'rebind.test': ['127.0.0.1'] })
    const res = await safeFetch(`http://rebind.test:${port}/models`, { lookupFn: dns.lookupFn })
    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(await res.json()).toEqual({ hola: `rebind.test:${port}` })
    expect(dns.calls()).toBe(1) // UNA resolución: la que fija el pin
  })

  test('una segunda resolución JAMÁS ocurre (regresión del TOCTOU de R13)', async () => {
    const s = listenHttp((res, rec) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ hola: rec.host }))
    })
    const { port, close } = await s.listen()
    closers.push(close)
    let calls = 0
    const lookupFn: LookupFn = async () => {
      calls++
      if (calls > 1) throw new Error('REBIND: segunda resolución — el fetch re-resolvió')
      return [{ address: '127.0.0.1', family: 4 }]
    }
    const res = await safeFetch(`http://rebind.test:${port}/x`, { lookupFn })
    expect(res.ok).toBe(true)
    expect(calls).toBe(1)
  })

  test('el servidor que recibe la conexión es el de la IP fijada (loopback), no el DNS real', async () => {
    // Con el código histórico (fetch a http://rebind.test:PORT) esta prueba
    // fallaría con ENOTFOUND: rebind.test no existe fuera del DNS falso.
    const s = listenHttp((res, rec) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ visto: rec.host, path: rec.path }))
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'solo-existe-en-el-guard.test': ['127.0.0.1'] })
    const res = await safeFetch(`http://solo-existe-en-el-guard.test:${port}/a?b=2`, { lookupFn: dns.lookupFn })
    const body = (await res.json()) as { visto: string; path: string }
    expect(body.visto).toBe(`solo-existe-en-el-guard.test:${port}`)
    expect(body.path).toBe('/a?b=2') // query preservada
  })

  test('POST con cuerpo y content-type llegan íntegros', async () => {
    const s = listenHttp((res, rec) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ eco: rec.body, path: rec.path }))
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    const res = await safeFetch(`http://proveedor.test:${port}/chat?x=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-test' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hola' }] }),
      lookupFn: dns.lookupFn,
    })
    const body = (await res.json()) as { eco: string; path: string }
    expect(body.path).toBe('/chat?x=1')
    expect(JSON.parse(body.eco)).toEqual({ model: 'm', messages: [{ role: 'user', content: 'hola' }] })
  })

  test('3xx no se sigue (anti-evasión del guard): error redirect', async () => {
    const s = listenHttp((res) => {
      res.writeHead(302, { location: 'http://metadata.google.internal/' })
      res.end()
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    await expectSafeFetchError(safeFetch(`http://proveedor.test:${port}/x`, { lookupFn: dns.lookupFn }), 'redirect')
  })
})

// ── metadata y política (bloqueos SIN conexión) ────────────────

describe('safeFetch — metadata SIEMPRE bloqueada y política del llamador', () => {
  test('hostname de metadata: bloqueado sin una sola resolución DNS', async () => {
    const dns = fakeDns({})
    await expectSafeFetchError(safeFetch('https://metadata.google.internal/v1', { lookupFn: dns.lookupFn }), 'metadata-blocked')
    expect(dns.calls()).toBe(0)
  })

  test('metadata vía DNS: bloqueado sin conexión', async () => {
    const dns = fakeDns({ 'rebind-malvado.test': ['169.254.169.254'] })
    await expectSafeFetchError(
      safeFetch('http://rebind-malvado.test/x', { lookupFn: dns.lookupFn, allowedKinds: ['public'] }),
      'metadata-blocked'
    )
  })

  test('metadata por literal IP: bloqueado', async () => {
    await expectSafeFetchError(safeFetch('http://169.254.169.254/latest/meta-data/', {}), 'metadata-blocked')
  })

  test('política allowedKinds: privado bloqueado si el llamador solo permite públicos', async () => {
    const dns = fakeDns({ 'interno.test': ['127.0.0.1'] })
    await expectSafeFetchError(
      safeFetch('http://interno.test/x', { lookupFn: dns.lookupFn, allowedKinds: ['public'] }),
      'policy-blocked'
    )
  })

  test('literal IP: pin directo sin DNS y con política', async () => {
    const s = listenHttp((res, rec) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ hola: rec.host }))
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const res = await safeFetch(`http://127.0.0.1:${port}/x`, { allowedKinds: ['private', 'public'] })
    expect(res.ok).toBe(true)
    expect(await res.json()).toEqual({ hola: `127.0.0.1:${port}` })
  })

  test('DNS que falla → dns-failed (fail-closed: sin IP no hay pin)', async () => {
    const dns = fakeDns({})
    await expectSafeFetchError(safeFetch('http://no-existe.test/x', { lookupFn: dns.lookupFn }), 'dns-failed')
  })
})

// ── robustez: tope, plazo, protocolo ───────────────────────────

describe('safeFetch — tope de respuesta, plazo y protocolo', () => {
  test('cuerpo mayor que maxResponseBytes → response-too-large', async () => {
    const s = listenHttp((res) => {
      const big = 'x'.repeat(64 * 1024)
      res.writeHead(200, { 'content-length': String(big.length) })
      res.end(big)
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    await expectSafeFetchError(
      safeFetch(`http://proveedor.test:${port}/x`, { lookupFn: dns.lookupFn, maxResponseBytes: 1024 }),
      'response-too-large'
    )
  })

  test('servidor que no responde → timeout (plazo total)', async () => {
    const silent = net.createServer(() => {}) // acepta y calla
    const { port, close } = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
      silent.listen(0, '127.0.0.1', () => {
        resolve({
          port: (silent.address() as net.AddressInfo).port,
          close: () => new Promise<void>((done) => silent.close(() => done())),
        })
      })
    })
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    await expectSafeFetchError(
      safeFetch(`http://proveedor.test:${port}/x`, { lookupFn: dns.lookupFn, timeoutMs: 400 }),
      'timeout'
    )
  })

  test('protocolo no http(s) y URL con credenciales → protocol', async () => {
    await expectSafeFetchError(safeFetch('ftp://proveedor.test/x', {}), 'protocol')
    await expectSafeFetchError(safeFetch('http://user:pass@proveedor.test/x', {}), 'protocol')
    await expectSafeFetchError(safeFetch('no-es-una-url', {}), 'protocol')
  })
})

// ── pin en https (cliente node:tls con SNI del nombre) ─────────

describe('safeFetch https — TCP a la IP fijada, TLS al nombre', () => {
  test('conecta a 127.0.0.1 con SNI proveedor.test, cert válido y Host original', async () => {
    const s = listenTls((sock) => writeJson(sock, 200, { hola: 'tls' }))
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    const res = await safeFetch(`https://proveedor.test:${port}/models`, {
      lookupFn: dns.lookupFn,
      tls: { ca: [crt] },
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hola: 'tls' })
    expect(dns.calls()).toBe(1)
    const rec = s.requests[0]
    expect(rec.host).toBe(`proveedor.test:${port}`) // Host original, no la IP
    // SNI: bun no expone getServername() en el servidor; la prueba fuerte del
    // nombre es esta misma verificación — el cert solo vale para
    // DNS:proveedor.test, así que el handshake solo pasa si el cliente
    // validó la identidad contra ESE nombre (servername) y no contra la IP.
    expect(res.ok).toBe(true)
  })

  test('chunked se decodifica (transfer-encoding sobre TLS)', async () => {
    const s = listenTls((sock) => {
      sock.write('HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ntransfer-encoding: chunked\r\n\r\n')
      const part1 = '{"a": "hola' // chunk 1: mitad de UN objeto (el body es la concatenación)
      const part2 = ' mundo"}'   // chunk 2: cierre → '{"a": "hola mundo"}'
      // tamaños hex calculados (un fallo aquí es decode malformada, no test frágil)
      sock.write(`${part1.length.toString(16)}\r\n${part1}\r\n`)
      sock.write(`${part2.length.toString(16)}\r\n${part2}\r\n`)
      sock.write('0\r\n\r\n')
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    const res = await safeFetch(`https://proveedor.test:${port}/x`, {
      lookupFn: dns.lookupFn,
      tls: { ca: [crt] },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ a: 'hola mundo' })
  })

  test('POST con cuerpo llega íntegro por TLS', async () => {
    const s = listenTls((sock, rec) => writeJson(sock, 200, { eco: rec.body }))
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    const payload = JSON.stringify({ model: 'm', temperature: 0.8, messages: [{ role: 'user', content: 'saludos' }] })
    const res = await safeFetch(`https://proveedor.test:${port}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-test' },
      body: payload,
      lookupFn: dns.lookupFn,
      tls: { ca: [crt] },
    })
    const body = (await res.json()) as { eco: string }
    expect(body.eco).toBe(payload)
  })

  test('3xx sobre TLS no se sigue: error redirect', async () => {
    const s = listenTls((sock) => {
      sock.write('HTTP/1.1 302 Found\r\nlocation: https://otro-proveedor.test/\r\ncontent-length: 0\r\n\r\n')
    })
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    await expectSafeFetchError(
      safeFetch(`https://proveedor.test:${port}/x`, { lookupFn: dns.lookupFn, tls: { ca: [crt] } }),
      'redirect'
    )
  })

  test('cert sin confianza (sin ca) → connect: la verificación TLS sigue activa', async () => {
    const s = listenTls((sock) => writeJson(sock, 200, { hola: 'tls' }))
    const { port, close } = await s.listen()
    closers.push(close)
    const dns = fakeDns({ 'proveedor.test': ['127.0.0.1'] })
    await expectSafeFetchError(
      safeFetch(`https://proveedor.test:${port}/x`, { lookupFn: dns.lookupFn }),
      'connect'
    )
  })
})
