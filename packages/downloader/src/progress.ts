export type YtdlpProgressEvent =
  | {
      type: 'progress'
      percent: number
      totalText: string
      speedText?: string
      etaText?: string
      raw: string
    }
  | {
      type: 'stage'
      stage: 'destination' | 'already-downloaded' | 'finished' | 'info'
      message: string
      raw: string
    }
  | {
      type: 'error'
      message: string
      raw: string
    }

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseYtdlpProgressLine(line: string): YtdlpProgressEvent | null {
  const raw = line.trim()
  if (!raw) return null

  const errorMatch = raw.match(/^ERROR:\s*(.+)$/)
  if (errorMatch?.[1]) {
    return { type: 'error', message: errorMatch[1].trim(), raw }
  }

  const destinationMatch = raw.match(/^\[download\]\s+Destination:\s+(.+)$/)
  if (destinationMatch?.[1]) {
    return { type: 'stage', stage: 'destination', message: destinationMatch[1].trim(), raw }
  }

  const alreadyMatch = raw.match(/^\[download\]\s+(.+?)\s+has already been downloaded$/)
  if (alreadyMatch?.[1]) {
    return { type: 'stage', stage: 'already-downloaded', message: alreadyMatch[1].trim(), raw }
  }

  const finishedMatch = raw.match(/^\[download\]\s+100%\s+of\s+(.+?)\s+in\s+(.+)$/)
  if (finishedMatch?.[1]) {
    return { type: 'stage', stage: 'finished', message: cleanText(`100% of ${finishedMatch[1]}`), raw }
  }

  const progressMatch = raw.match(/^\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+(.+?)(?:\s+at\s+(.+?))?(?:\s+ETA\s+(\S+))?$/)
  if (progressMatch?.[1] && progressMatch[2]) {
    const event: YtdlpProgressEvent = {
      type: 'progress',
      percent: Number(progressMatch[1]),
      totalText: cleanText(progressMatch[2]),
      raw,
    }
    if (progressMatch[3]) event.speedText = cleanText(progressMatch[3])
    if (progressMatch[4]) event.etaText = progressMatch[4].trim()
    return event
  }

  if (raw.startsWith('[download]') || raw.startsWith('[info]')) {
    return { type: 'stage', stage: 'info', message: raw.replace(/^\[[^\]]+\]\s*/, ''), raw }
  }

  return null
}
