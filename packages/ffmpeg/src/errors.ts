export type NormalizedFfmpegError = {
  code: 'tool-not-found' | 'invalid-input' | 'codec' | 'permission' | 'disk-full' | 'canceled' | 'unknown'
  message: string
  retryable: boolean
}

export function normalizeFfmpegError(raw: string): NormalizedFfmpegError {
  const message = raw.trim() || 'FFmpeg 执行失败。'
  const lower = message.toLowerCase()

  if (lower.includes('no such file') || lower.includes('does not exist')) {
    return { code: 'invalid-input', message: '输入文件不存在。', retryable: false }
  }

  if (lower.includes('invalid data') || lower.includes('invalid argument')) {
    return { code: 'invalid-input', message: '输入文件格式无效或损坏。', retryable: false }
  }

  if (lower.includes('unknown encoder') || lower.includes('encoder not found') || lower.includes('codec not found')) {
    return { code: 'codec', message: '编解码器不支持或未安装。', retryable: false }
  }

  if (lower.includes('permission denied') || lower.includes('access denied')) {
    return { code: 'permission', message: '文件权限不足。', retryable: false }
  }

  if (lower.includes('no space left') || lower.includes('disk full')) {
    return { code: 'disk-full', message: '磁盘空间不足。', retryable: false }
  }

  return { code: 'unknown', message, retryable: true }
}

export class FfmpegRunError extends Error {
  readonly normalized: NormalizedFfmpegError
  readonly exitCode: number | null
  readonly stderr: string

  constructor(input: { normalized: NormalizedFfmpegError; exitCode: number | null; stderr: string }) {
    super(input.normalized.message)
    this.name = 'FfmpegRunError'
    this.normalized = input.normalized
    this.exitCode = input.exitCode
    this.stderr = input.stderr
  }
}

export class FfmpegToolNotFoundError extends Error {
  readonly attempts: string[]

  constructor(attempts: string[]) {
    super('未找到可用的 ffmpeg。')
    this.name = 'FfmpegToolNotFoundError'
    this.attempts = attempts
  }
}
