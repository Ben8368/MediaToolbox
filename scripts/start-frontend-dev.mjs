#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const frontendDir = join(repoRoot, 'frontend')
const packageJson = join(frontendDir, 'package.json')
const nodeModules = join(frontendDir, 'node_modules')

const args = process.argv.slice(2)
const options = {
  host: process.env.MEDIATOOLBOX_DEV_HOST || '127.0.0.1',
  port: process.env.MEDIATOOLBOX_DEV_PORT || '5173',
  apiBase: process.env.VITE_API_BASE_URL || '',
}

function takeValue(flag, index) {
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
  if (arg === '--api-base' || arg.startsWith('--api-base=')) {
    options.apiBase = takeValue('--api-base', index)
    if (arg === '--api-base') index += 1
  }
}

if (!existsSync(packageJson)) {
  console.error(`[MediaToolbox] frontend package not found: ${packageJson}`)
  process.exit(1)
}

if (!existsSync(nodeModules)) {
  console.error('[MediaToolbox] frontend dependencies are not installed.')
  console.error('[MediaToolbox] Run: npm --prefix frontend install')
  process.exit(1)
}

if (!options.apiBase) {
  options.apiBase = 'http://127.0.0.1:8080'
}

const env = {
  ...process.env,
  VITE_API_MODE: 'real',
}

if (options.apiBase) {
  env.VITE_API_BASE_URL = options.apiBase
}

console.log(`[MediaToolbox] Starting frontend dev server on http://${options.host}:${options.port}`)
console.log(`[MediaToolbox] API mode: real (${options.apiBase})`)

const npmArgs = ['--prefix', frontendDir, 'run', 'dev', '--', '--host', options.host, '--port', options.port]
const npmInvocation = getNpmInvocation(npmArgs)
const child = spawn(npmInvocation.command, npmInvocation.args, {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
  shell: npmInvocation.shell,
})

child.on('error', (error) => {
  console.error(`[MediaToolbox] Failed to start frontend: ${error.message}`)
  console.error(`[MediaToolbox] Command: ${npmInvocation.command} ${npmInvocation.args.join(' ')}`)
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal)
  })
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

function printHelp() {
  console.log(`MediaToolbox frontend dev launcher

Usage:
  node scripts/start-frontend-dev.mjs [options]

Options:
  --host <host>       Dev server host. Default: 127.0.0.1
  --port <port>       Dev server port. Default: 5173
  --real              Accepted for compatibility; real HTTP API mode is always used
  --api-base <url>    Real API base URL. Default: http://127.0.0.1:8080
  --help              Show this help

Environment overrides:
  MEDIATOOLBOX_DEV_HOST
  MEDIATOOLBOX_DEV_PORT
  VITE_API_BASE_URL`)
}

function getNpmInvocation(npmArgs) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      args: [npmExecPath, ...npmArgs],
      shell: false,
    }
  }

  // Fallback: rely on PATH resolution. On Windows `npm` is a .cmd shim, so it
  // must run through a shell; on POSIX a direct spawn is enough.
  return {
    command: 'npm',
    args: npmArgs,
    shell: process.platform === 'win32',
  }
}
