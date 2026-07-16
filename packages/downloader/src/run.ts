import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import { terminateProcessTree } from '@mediatoolbox/process-manager'

import { buildYtdlpArgs, type YtdlpRequest } from './args.js'
import { normalizeYtdlpError, YtdlpRunError } from './errors.js'
import { parseYtdlpProgressLine, type YtdlpProgressEvent } from './progress.js'

export type YtdlpSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams

export type YtdlpRunOptions = {
  command?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  onEvent?: (event: YtdlpProgressEvent) => void
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
  spawnProcess?: YtdlpSpawn
  terminateProcess?: (child: ChildProcessWithoutNullStreams) => Promise<void>
}

export type YtdlpRunResult = {
  status: 'succeeded' | 'canceled'
  command: string
  args: string[]
  exitCode: number | null
  events: YtdlpProgressEvent[]
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

export function runYtdlpDownload(request: YtdlpRequest, options: YtdlpRunOptions = {}): Promise<YtdlpRunResult> {
  const command = options.command ?? 'yt-dlp'
  const args = buildYtdlpArgs(request)
  const spawnProcess: YtdlpSpawn = options.spawnProcess ?? ((spawnCommand, spawnArgs, spawnOptions) => spawn(spawnCommand, spawnArgs, spawnOptions))
  const terminateProcess = options.terminateProcess ?? ((child) => terminateProcessTree(child))
  const events: YtdlpProgressEvent[] = []
  let stderrText = ''
  let canceled = false

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      resolve({ status: 'canceled', command, args, exitCode: null, events })
      return
    }

    const spawnOptions: SpawnOptionsWithoutStdio = {
      stdio: 'pipe',
      windowsHide: true,
    }
    if (options.cwd) spawnOptions.cwd = options.cwd
    if (options.env) spawnOptions.env = options.env

    const child = spawnProcess(command, args, spawnOptions)

    const handleLine = (line: string, stream: 'stdout' | 'stderr') => {
      options.onLog?.(line, stream)
      if (stream === 'stderr') stderrText += `${line}\n`
      const event = parseYtdlpProgressLine(line)
      if (!event) return
      events.push(event)
      options.onEvent?.(event)
    }

    const stdout = createLineReader((line) => handleLine(line, 'stdout'))
    const stderr = createLineReader((line) => handleLine(line, 'stderr'))

    const abort = () => {
      canceled = true
      void terminateProcess(child).catch(() => {
        child.kill()
      })
    }

    options.signal?.addEventListener('abort', abort, { once: true })

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    child.once('error', (error) => {
      options.signal?.removeEventListener('abort', abort)
      reject(new YtdlpRunError({
        normalized: normalizeYtdlpError(error.message),
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

      let errorEvent: Extract<YtdlpProgressEvent, { type: 'error' }> | undefined
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]
        if (event?.type === 'error') {
          errorEvent = event
          break
        }
      }
      reject(new YtdlpRunError({
        normalized: normalizeYtdlpError(errorEvent?.message ?? stderrText),
        exitCode: code,
        stderr: stderrText,
      }))
    })
  })
}
