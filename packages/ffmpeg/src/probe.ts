import { spawn } from 'node:child_process'

export type FfprobeStream = {
  codec_type: 'video' | 'audio' | 'subtitle' | 'data' | string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  bit_rate?: string
  sample_rate?: string
  channels?: number
  duration?: string
}

export type FfprobeFormat = {
  filename?: string
  duration?: string
  size?: string
  bit_rate?: string
  format_name?: string
}

export type FfprobeResult = {
  streams: FfprobeStream[]
  format: FfprobeFormat
}

export type ProbeMediaOptions = {
  command?: string
  signal?: AbortSignal
}

export function parseProbeResult(raw: string): FfprobeResult {
  try {
    const parsed = JSON.parse(raw) as { streams?: FfprobeStream[]; format?: FfprobeFormat }
    return {
      streams: parsed.streams ?? [],
      format: parsed.format ?? {},
    }
  } catch {
    return { streams: [], format: {} }
  }
}

export function getDurationSeconds(result: FfprobeResult): number | undefined {
  const value = result.format.duration
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function probeMedia(inputPath: string, options: ProbeMediaOptions = {}): Promise<FfprobeResult> {
  const command = options.command ?? 'ffprobe'
  const args = ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', inputPath]

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error('探针任务已被取消。'))
      return
    }

    const child = spawn(command, args, { stdio: 'pipe', windowsHide: true })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    const abort = () => child.kill()
    options.signal?.addEventListener('abort', abort, { once: true })

    child.once('error', (err) => {
      options.signal?.removeEventListener('abort', abort)
      reject(err)
    })

    child.once('close', (code) => {
      options.signal?.removeEventListener('abort', abort)
      if (code === 0) {
        resolve(parseProbeResult(stdout))
      } else {
        reject(new Error(stderr.trim() || `ffprobe 退出码 ${code}`))
      }
    })
  })
}
