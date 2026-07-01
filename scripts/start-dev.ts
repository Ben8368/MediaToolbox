#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ChildProcess, spawn } from 'node:child_process'

type DevOptions = {
  host: string
  port: string
  backendHost: string
  backendPort: string
  apiBase: string
}

type NpmInvocation = {
  command: string
  args: string[]
  shell: boolean
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const frontendDir = join(repoRoot, 'frontend')
const backendDir = join(repoRoot, 'backend')
const frontendScript = join(scriptDir, 'start-frontend-dev.ts')

const args = process.argv.slice(2)
const options: DevOptions = {
  host: process.env.MEDIATOOLBOX_DEV_HOST || '127.0.0.1',
  port: process.env.MEDIATOOLBOX_DEV_PORT || '5173',
  backendHost: process.env.MEDIATOOLBOX_BACKEND_HOST || '127.0.0.1',
  backendPort: process.env.MEDIATOOLBOX_BACKEND_PORT || process.env.PORT || '8080',
  apiBase: process.env.VITE_API_BASE_URL || '',
}

function takeValue(flag: string, index: number): string {
  const inlinePrefix = `${flag}=`
  const current = args[index]
  if (current.startsWith(inlinePrefix)) return current.slice(inlinePrefix.length)
  return args[index + 1]
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === '--help' || arg === '-h') {
    printHelp()
    process.exit(0)
  }
  if (arg === '--real') continue
  if (arg === '--host' || arg.startsWith('--host=')) {
    options.host = takeValue('--host', index)
    if (arg === '--host') index += 1
    continue
  }
  if (arg === '--port' || arg.startsWith('--port=')) {
    options.port = takeValue('--port', index)
    if (arg === '--port') index += 1
    continue
  }
  if (arg === '--backend-host' || arg.startsWith('--backend-host=')) {
    options.backendHost = takeValue('--backend-host', index)
    if (arg === '--backend-host') index += 1
    continue
  }
  if (arg === '--backend-port' || arg.startsWith('--backend-port=')) {
    options.backendPort = takeValue('--backend-port', index)
    if (arg === '--backend-port') index += 1
    continue
  }
  if (arg === '--api-base' || arg.startsWith('--api-base=')) {
    options.apiBase = takeValue('--api-base', index)
    if (arg === '--api-base') index += 1
  }
}

ensurePackage(frontendDir, 'frontend')
ensurePackage(backendDir, 'backend')

const clientBackendHost = options.backendHost === '0.0.0.0' ? '127.0.0.1' : options.backendHost
const apiBase = options.apiBase || `http://${clientBackendHost}:${options.backendPort}`
const frontendOriginHost = options.host === '0.0.0.0' ? 'localhost' : options.host
const frontendOrigin = `http://${frontendOriginHost}:${options.port}`
const children: ChildProcess[] = []
let shuttingDown = false
const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

ensureNodeModules(backendDir, 'backend')
startBackend(frontendOrigin)
ensureNodeModules(frontendDir, 'frontend')
startFrontend(apiBase)

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    shutdown(signal)
  })
}

function startBackend(frontendOrigin: string): void {
  const npmArgs = ['--prefix', backendDir, 'run', 'dev']
  const npmInvocation = getNpmInvocation(npmArgs)
  const env = {
    ...process.env,
    HOST: options.backendHost,
    PORT: options.backendPort,
    CORS_ORIGIN: process.env.CORS_ORIGIN || frontendOrigin,
  }

  console.log(`[MediaToolbox] Starting backend on http://${options.backendHost}:${options.backendPort}`)
  console.log(`[MediaToolbox] Backend CORS origin: ${env.CORS_ORIGIN}`)

  spawnManaged('backend', npmInvocation.command, npmInvocation.args, {
    cwd: repoRoot,
    env,
    shell: npmInvocation.shell,
  })
}

function startFrontend(apiBase: string): void {
  const frontendArgs = [
    frontendScript,
    '--real',
    '--host',
    options.host,
    '--port',
    options.port,
    '--api-base',
    apiBase,
  ]

  console.log(`[MediaToolbox] Starting frontend on http://${options.host}:${options.port}`)
  console.log(`[MediaToolbox] Frontend API base: ${apiBase}`)

  spawnManaged('frontend', process.execPath, frontendArgs, {
    cwd: repoRoot,
    env: process.env,
    shell: false,
  })
}

function spawnManaged(
  name: string,
  command: string,
  childArgs: string[],
  options: Parameters<typeof spawn>[2],
): void {
  const child = spawn(command, childArgs, {
    ...options,
    stdio: 'inherit',
  })

  children.push(child)

  child.on('error', (error) => {
    console.error(`[MediaToolbox] Failed to start ${name}: ${error.message}`)
    shutdown(null, 1)
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    if (signal) {
      console.error(`[MediaToolbox] ${name} stopped by ${signal}`)
      shutdown(null, 1)
      return
    }
    if (code !== 0) {
      console.error(`[MediaToolbox] ${name} exited with code ${code}`)
      shutdown(null, code ?? 1)
      return
    }
    shutdown(null, 0)
  })
}

function shutdown(signal: NodeJS.Signals | null, exitCode = 0): void {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill(signal || 'SIGTERM')
  }

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(exitCode)
}

function ensurePackage(dir: string, label: string): void {
  if (!existsSync(join(dir, 'package.json'))) {
    console.error(`[MediaToolbox] ${label} package not found: ${dir}`)
    process.exit(1)
  }
}

function ensureNodeModules(dir: string, label: string): void {
  if (!existsSync(join(dir, 'node_modules'))) {
    console.error(`[MediaToolbox] ${label} dependencies are not installed.`)
    console.error(`[MediaToolbox] Run: npm --prefix ${label} install`)
    process.exit(1)
  }
}

function printHelp(): void {
  console.log(`MediaToolbox one-command dev launcher

Usage:
  node scripts/start-dev.ts [options]

Default:
  Starts backend and frontend together, with the frontend using the real API.

Options:
  --real                    Accepted for compatibility; real API mode is always used
  --host <host>             Frontend dev server host. Default: 127.0.0.1
  --port <port>             Frontend dev server port. Default: 5173
  --backend-host <host>     Backend host. Default: 127.0.0.1
  --backend-port <port>     Backend port. Default: 8080
  --api-base <url>          Frontend real API base URL. Default: http://127.0.0.1:8080
  --help                    Show this help

Environment overrides:
  MEDIATOOLBOX_DEV_HOST
  MEDIATOOLBOX_DEV_PORT
  MEDIATOOLBOX_BACKEND_HOST
  MEDIATOOLBOX_BACKEND_PORT
  VITE_API_BASE_URL
  CORS_ORIGIN`)
}

function getNpmInvocation(npmArgs: string[]): NpmInvocation {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      args: [npmExecPath, ...npmArgs],
      shell: false,
    }
  }

  return {
    command: 'npm',
    args: npmArgs,
    shell: process.platform === 'win32',
  }
}
