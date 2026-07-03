import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createDevProcessSpecs,
  createMediaToolboxProcessManager,
} from '../packages/process-manager/src/index.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const host = process.env.HOST ?? '127.0.0.1'
const apiPort = Number(process.env.PORT ?? process.env.API_PORT ?? 3701)
const webPort = Number(process.env.WEB_PORT ?? 5173)
const shutdownDrainMs = Number(process.env.MEDIATOOLBOX_SHUTDOWN_DRAIN_MS ?? 1000)
const token = randomBytes(16).toString('hex')
const manager = createMediaToolboxProcessManager({
  onLog: ({ name, stream, text }) => {
    const prefix = `[${name}:${stream}]`
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      console.log(`${prefix} ${line}`)
    }
  },
})

let shuttingDown = false
let controlServer: Server | null = null

function requestUrl(reqUrl: string | undefined) {
  return new URL(reqUrl || '/', `http://${host}`)
}

async function shutdown(reason: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[supervisor] Shutting down: ${reason}`)
  controlServer?.close()
  await manager.shutdownAll()
}

controlServer = createServer((req, res) => {
  const url = requestUrl(req.url)
  if (req.method !== 'POST' || url.pathname !== '/shutdown' || url.searchParams.get('token') !== token) {
    res.writeHead(404).end()
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true }))
  setTimeout(() => {
    void shutdown('frontend requested shutdown').then(() => process.exit(0))
  }, shutdownDrainMs)
})

controlServer.listen(0, host, () => {
  const address = controlServer?.address()
  if (!address || typeof address === 'string') {
    throw new Error('Supervisor control server did not expose a TCP address.')
  }

  const supervisorShutdownUrl = `http://${host}:${address.port}/shutdown?token=${token}`
  const specs = createDevProcessSpecs({ rootDir, host, apiPort, webPort, supervisorShutdownUrl })
  manager.startMany(specs)

  console.log(`[supervisor] Web: http://${host}:${webPort}/`)
  console.log(`[supervisor] API: http://${host}:${apiPort}/`)
})

process.once('SIGINT', () => {
  void shutdown('SIGINT').then(() => process.exit(0))
})
process.once('SIGTERM', () => {
  void shutdown('SIGTERM').then(() => process.exit(0))
})
process.once('uncaughtException', (error) => {
  console.error(error)
  void shutdown('uncaught exception').then(() => process.exit(1))
})
