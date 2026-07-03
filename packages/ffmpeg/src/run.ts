import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'

import { buildFfmpegArgs, type TranscodeRequest } from './args.js'
import { normalizeFfmpegError, FfmpegRunError } from './errors.js'
import { parseFfmpegProgressLine, makeFfmpegProgressArgs, type FfmpegProgressEvent } from './progress.js'

export type FfmpegSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams

export type FfmpegRunOptions = {
  command?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  durationSeconds?: number
  onEvent?: (event: FfmpegProgressEvent) => void
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
  spawnProcess?: FfmpegSpawn
}

export type FfmpegRunResult = {
  status: 'succeeded' | 'canceled'
  command: string
  args: string[]
  exitCode: number | null
  events: FfmpegProgressEvent[]
}

function createLineReader(onLine: (line: string) => void) {
  let pending = ''
  return {
    push(chunk: Buffer | string) {
      pending += chunk.toString()
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) onLine(line)
    },
    flush() {
      if (!pending) return
      onLine(pending)
      pending = ''
    },
  }
}

export function runFfmpeg(request: TranscodeRequest, options: FfmpegRunOptions = {}): Promise<FfmpegRunResult> {
  const command = options.command ?? 'ffmpeg'
  // Inject -progress pipe:1 -nostats before output args so we get structured progress on stdout
  const baseArgs = buildFfmpegArgs(request)
  const progressArgs = makeFfmpegProgressArgs(1)
  // Insert progress flags before the output path (last arg)
  const outputPath = baseArgs[baseArgs.length - 1]!
  const args = [...baseArgs.slice(0, -1), ...progressArgs, '-y', outputPath]

  const spawnFn: FfmpegSpawn = options.spawnProcess ?? ((cmd, a, opts) => spawn(cmd, a, opts))
  const events: FfmpegProgressEvent[] = []
  let stderrText = ''
  let canceled = false

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      resolve({ status: 'canceled', command, args, exitCode: null, events })
      return
    }

    const spawnOptions: SpawnOptionsWithoutStdio = { stdio: 'pipe', windowsHide: true }
    if (options.cwd) spawnOptions.cwd = options.cwd
    if (options.env) spawnOptions.env = options.env

    const child = spawnFn(command, args, spawnOptions)

    const handleLine = (line: string, stream: 'stdout' | 'stderr') => {
      options.onLog?.(line, stream)
      if (stream === 'stderr') stderrText += `${line}\n`
      const event = parseFfmpegProgressLine(line, options.durationSeconds)
      if (!event) return
      events.push(event)
      options.onEvent?.(event)
    }

    const stdout = createLineReader((line) => handleLine(line, 'stdout'))
    const stderr = createLineReader((line) => handleLine(line, 'stderr'))

    const abort = () => {
      canceled = true
      child.kill()
    }

    options.signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    child.once('error', (error) => {
      options.signal?.removeEventListener('abort', abort)
      reject(new FfmpegRunError({
        normalized: normalizeFfmpegError(error.message),
        exitCode: null,
        stderr: error.message,
      }))
    })

    child.once('close', (code) => {
      options.signal?.removeEventListener('abort', abort)
      stdout.flush()
      stderr.flush()

      if (canceled) {
        resolve({ status: 'canceled', command, args, exitCode: code, events })
        return
      }

      if (code === 0) {
        resolve({ status: 'succeeded', command, args, exitCode: code, events })
        return
      }

      let errorEvent: Extract<FfmpegProgressEvent, { type: 'error' }> | undefined
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i]
        if (ev?.type === 'error') { errorEvent = ev; break }
      }

      reject(new FfmpegRunError({
        normalized: normalizeFfmpegError(errorEvent?.message ?? stderrText),
        exitCode: code,
        stderr: stderrText,
      }))
    })
  })
}
