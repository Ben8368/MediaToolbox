export type FfmpegProgressEvent =
  | {
      type: 'progress'
      percent: number
      timeSeconds: number
      fps?: number
      bitrateKbps?: number
      raw: string
    }
  | {
      type: 'stage'
      stage: 'start' | 'end'
      message: string
      raw: string
    }
  | {
      type: 'error'
      message: string
      raw: string
    }

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) {
    const [h = 0, m = 0, s = 0] = parts
    return h * 3600 + m * 60 + s
  }
  return Number(time) || 0
}

// ffmpeg -progress pipe:1 outputs key=value lines; we parse those.
// Also handles plain stderr output for stage detection.
export function parseFfmpegProgressLine(line: string, durationSeconds?: number): FfmpegProgressEvent | null {
  const raw = line.trim()
  if (!raw) return null

  // -progress pipe format: out_time_ms=...
  const outTimeMatch = raw.match(/^out_time(?:_ms)?=(.+)$/)
  if (outTimeMatch?.[1]) {
    const value = outTimeMatch[1].trim()
    let timeSeconds: number
    if (raw.startsWith('out_time_ms=')) {
      timeSeconds = Number(value) / 1_000_000
    } else {
      timeSeconds = parseTimeToSeconds(value)
    }
    const percent = durationSeconds && durationSeconds > 0 ? Math.min(100, (timeSeconds / durationSeconds) * 100) : 0
    return { type: 'progress', percent: Math.round(percent * 10) / 10, timeSeconds, raw }
  }

  const fpsMatch = raw.match(/^fps=(.+)$/)
  if (fpsMatch) return null // fps alone is not an event; merged via out_time above

  const progressEndMatch = raw.match(/^progress=end$/)
  if (progressEndMatch) {
    return { type: 'stage', stage: 'end', message: '转码完成', raw }
  }

  const progressStartMatch = raw.match(/^progress=continue$/)
  if (progressStartMatch) return null

  // Detect ffmpeg error lines from stderr
  const errorMatch = raw.match(/^(?:Error|error|FATAL)[:]\s*(.+)$/)
  if (errorMatch?.[1]) {
    return { type: 'error', message: errorMatch[1].trim(), raw }
  }

  return null
}

export function makeFfmpegProgressArgs(outputFd: number = 1): string[] {
  return ['-progress', `pipe:${outputFd}`, '-nostats']
}
