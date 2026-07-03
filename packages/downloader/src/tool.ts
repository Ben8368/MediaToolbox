import { spawn } from 'node:child_process'

import { YtdlpToolNotFoundError } from './errors.js'

export type YtdlpToolSource = 'custom' | 'managed' | 'path'

export type YtdlpToolCandidate = {
  source: YtdlpToolSource
  command: string
}

export type ResolvedYtdlpTool = YtdlpToolCandidate & {
  version: string
}

export type YtdlpProbeResult = {
  ok: boolean
  version?: string
}

export type YtdlpProbe = (command: string) => Promise<YtdlpProbeResult>

export type ResolveYtdlpToolOptions = {
  customPath?: string
  managedPath?: string
  commandName?: string
  probe?: YtdlpProbe
}

export function getYtdlpCandidates(options: ResolveYtdlpToolOptions = {}): YtdlpToolCandidate[] {
  const candidates: YtdlpToolCandidate[] = []
  const customPath = options.customPath?.trim()
  const managedPath = options.managedPath?.trim()

  if (customPath) candidates.push({ source: 'custom', command: customPath })
  if (managedPath) candidates.push({ source: 'managed', command: managedPath })
  candidates.push({ source: 'path', command: options.commandName?.trim() || 'yt-dlp' })

  return candidates
}

export async function probeYtdlpCommand(command: string): Promise<YtdlpProbeResult> {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { stdio: 'pipe', windowsHide: true })
    let stdout = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })

    child.once('error', () => {
      resolve({ ok: false })
    })

    child.once('close', (code) => {
      if (code === 0) {
        const version = stdout.trim().split(/\r?\n/)[0]
        resolve(version ? { ok: true, version } : { ok: true })
        return
      }
      resolve({ ok: false })
    })
  })
}

export async function resolveYtdlpTool(options: ResolveYtdlpToolOptions = {}): Promise<ResolvedYtdlpTool> {
  const candidates = getYtdlpCandidates(options)
  const probe = options.probe ?? probeYtdlpCommand
  const attempts: string[] = []

  for (const candidate of candidates) {
    attempts.push(candidate.command)
    const result = await probe(candidate.command)
    if (result.ok) {
      return {
        ...candidate,
        version: result.version ?? 'unknown',
      }
    }
  }

  throw new YtdlpToolNotFoundError(attempts)
}
