import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import path from 'node:path'

export type ManagedProcessName = 'api' | 'web' | 'download-worker' | 'transcode-worker' | 'psd-worker' | string

export type ManagedProcessSpec = {
  name: ManagedProcessName
  command: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
}

export type DevProcessSpecOptions = {
  rootDir: string
  host?: string
  apiPort?: number
  webPort?: number
  supervisorShutdownUrl?: string
}

export type ManagedProcessLog = {
  name: ManagedProcessName
  stream: 'stdout' | 'stderr'
  text: string
}

export type ProcessManagerOptions = {
  onLog?: (entry: ManagedProcessLog) => void
}

export type RunningManagedProcess = {
  name: ManagedProcessName
  child: ChildProcess
  spec: ManagedProcessSpec
}

export type ShutdownOptions = {
  forceAfterMs?: number
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_API_PORT = 3701
const DEFAULT_WEB_PORT = 5173

export function createDevProcessSpecs(options: DevProcessSpecOptions): ManagedProcessSpec[] {
  const host = options.host ?? DEFAULT_HOST
  const apiPort = options.apiPort ?? DEFAULT_API_PORT
  const webPort = options.webPort ?? DEFAULT_WEB_PORT
  const rootDir = options.rootDir
  const node = process.execPath

  return [
    {
      name: 'api',
      command: node,
      args: [path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'],
      cwd: path.join(rootDir, 'apps', 'api'),
      env: {
        HOST: host,
        PORT: String(apiPort),
        ...(options.supervisorShutdownUrl
          ? { MEDIATOOLBOX_SUPERVISOR_SHUTDOWN_URL: options.supervisorShutdownUrl }
          : {}),
      },
    },
    {
      name: 'web',
      command: node,
      args: [
        path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'),
        '--host',
        host,
        '--port',
        String(webPort),
        '--strictPort',
      ],
      cwd: path.join(rootDir, 'apps', 'web'),
      env: {
        PORT: String(apiPort),
      },
    },
  ]
}

export class MediaToolboxProcessManager {
  private readonly processes = new Map<ManagedProcessName, RunningManagedProcess>()

  constructor(private readonly options: ProcessManagerOptions = {}) {}

  start(spec: ManagedProcessSpec): RunningManagedProcess {
    if (this.processes.has(spec.name)) {
      throw new Error(`Process ${spec.name} is already running.`)
    }

    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: normalizeProcessEnv({ ...process.env, ...spec.env }),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    } satisfies SpawnOptions)

    child.stdout?.on('data', (chunk: Buffer) => {
      this.options.onLog?.({ name: spec.name, stream: 'stdout', text: chunk.toString() })
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      this.options.onLog?.({ name: spec.name, stream: 'stderr', text: chunk.toString() })
    })
    child.on('exit', () => {
      this.processes.delete(spec.name)
    })

    const running = { name: spec.name, child, spec }
    this.processes.set(spec.name, running)
    return running
  }

  startMany(specs: ManagedProcessSpec[]): RunningManagedProcess[] {
    return specs.map((spec) => this.start(spec))
  }

  list(): RunningManagedProcess[] {
    return [...this.processes.values()]
  }

  async shutdownAll(options: ShutdownOptions = {}): Promise<void> {
    const forceAfterMs = options.forceAfterMs ?? 3000
    const running = this.list().reverse()
    await Promise.all(running.map((processItem) => terminateProcessTree(processItem.child, { forceAfterMs })))
    this.processes.clear()
  }
}

export function createMediaToolboxProcessManager(options?: ProcessManagerOptions): MediaToolboxProcessManager {
  return new MediaToolboxProcessManager(options)
}

export function normalizeProcessEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const normalized: NodeJS.ProcessEnv = {}
  const seen = new Set<string>()
  const keys = Object.keys(env).sort((a, b) => {
    if (a === 'Path') return -1
    if (b === 'Path') return 1
    return a.localeCompare(b)
  })

  for (const key of keys) {
    const lower = key.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    normalized[key] = env[key]
  }

  return normalized
}

export async function terminateProcessTree(child: ChildProcess, options: ShutdownOptions = {}): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return
  const forceAfterMs = options.forceAfterMs ?? 3000

  if (process.platform === 'win32') {
    await runTaskkill(child.pid)
    return
  }

  child.kill('SIGTERM')
  await waitForExitOrKill(child, forceAfterMs)
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    killer.on('exit', () => resolve())
    killer.on('error', () => resolve())
  })
}

function waitForExitOrKill(child: ChildProcess, forceAfterMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, forceAfterMs)

    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
