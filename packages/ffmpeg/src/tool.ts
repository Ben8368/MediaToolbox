import { spawn } from 'node:child_process'

export type FfmpegToolSource = 'custom' | 'managed' | 'path'

export type FfmpegToolCandidate = {
  source: FfmpegToolSource
  command: string
}

export type ResolvedFfmpegTool = FfmpegToolCandidate & {
  version: string
}

export type FfmpegProbeResult = {
  ok: boolean
  version?: string
}

export type FfmpegProbe = (command: string) => Promise<FfmpegProbeResult>

export type ResolveFfmpegToolOptions = {
  customPath?: string
  managedPath?: string
  commandName?: string
  probe?: FfmpegProbe
}

export function getFfmpegCandidates(options: ResolveFfmpegToolOptions = {}): FfmpegToolCandidate[] {
  const candidates: FfmpegToolCandidate[] = []
  const customPath = options.customPath?.trim()
  const managedPath = options.managedPath?.trim()

  if (customPath) candidates.push({ source: 'custom', command: customPath })
  if (managedPath) candidates.push({ source: 'managed', command: managedPath })
  candidates.push({ source: 'path', command: options.commandName?.trim() || 'ffmpeg' })

  return candidates
}

export async function probeFfmpegCommand(command: string): Promise<FfmpegProbeResult> {
  return new Promise((resolve) => {
    const child = spawn(command, ['-version'], { stdio: 'pipe', windowsHide: true })
    let stdout = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })

    child.once('error', () => {
      resolve({ ok: false })
    })

    child.once('close', (code) => {
      if (code === 0) {
        const firstLine = stdout.trim().split(/\r?\n/)[0]
        const versionMatch = firstLine?.match(/ffmpeg version ([^\s]+)/)
        const version = versionMatch?.[1] ?? 'unknown'
        resolve({ ok: true, version })
        return
      }
      resolve({ ok: false })
    })
  })
}

export async function resolveFfmpegTool(options: ResolveFfmpegToolOptions = {}): Promise<ResolvedFfmpegTool> {
  const candidates = getFfmpegCandidates(options)
  const probe = options.probe ?? probeFfmpegCommand
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

  throw new Error(`未找到可用的 ffmpeg。尝试了：${attempts.join(', ')}`)
}

export function getFfprobeCandidates(options: ResolveFfmpegToolOptions = {}): FfmpegToolCandidate[] {
  const candidates: FfmpegToolCandidate[] = []
  const customPath = options.customPath?.trim()
  const managedPath = options.managedPath?.trim()

  if (customPath) candidates.push({ source: 'custom', command: customPath })
  if (managedPath) candidates.push({ source: 'managed', command: managedPath })
  candidates.push({ source: 'path', command: options.commandName?.trim() || 'ffprobe' })

  return candidates
}

export async function probeFfprobeCommand(command: string): Promise<FfmpegProbeResult> {
  return new Promise((resolve) => {
    const child = spawn(command, ['-version'], { stdio: 'pipe', windowsHide: true })
    let stdout = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })

    child.once('error', () => {
      resolve({ ok: false })
    })

    child.once('close', (code) => {
      if (code === 0) {
        const firstLine = stdout.trim().split(/\r?\n/)[0]
        const versionMatch = firstLine?.match(/ffprobe version ([^\s]+)/)
        const version = versionMatch?.[1] ?? 'unknown'
        resolve({ ok: true, version })
        return
      }
      resolve({ ok: false })
    })
  })
}

export async function resolveFfprobeTool(options: ResolveFfmpegToolOptions = {}): Promise<ResolvedFfmpegTool> {
  const candidates = getFfprobeCandidates(options)
  const probe = options.probe ?? probeFfprobeCommand
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

  throw new Error(`未找到可用的 ffprobe。尝试了：${attempts.join(', ')}`)
}
