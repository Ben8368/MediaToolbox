export type NormalizedYtdlpError = {
  code: 'tool-not-found' | 'unsupported-url' | 'network' | 'permission' | 'postprocess' | 'canceled' | 'unknown'
  message: string
  retryable: boolean
}

export function normalizeYtdlpError(raw: string): NormalizedYtdlpError {
  const message = raw.trim() || '下载执行失败。'
  const lower = message.toLowerCase()

  if (lower.includes('unsupported url') || lower.includes('no suitable extractor')) {
    return { code: 'unsupported-url', message: '当前链接不受 yt-dlp 支持。', retryable: false }
  }

  if (lower.includes('private video') || lower.includes('sign in') || lower.includes('cookies')) {
    return { code: 'permission', message: '下载需要登录凭据或 Cookie。', retryable: false }
  }

  if (lower.includes('http error 403') || lower.includes('http error 404')) {
    return { code: 'permission', message: '远端拒绝访问或资源不存在。', retryable: false }
  }

  if (lower.includes('timed out') || lower.includes('temporary failure') || lower.includes('connection reset')) {
    return { code: 'network', message: '网络连接异常，稍后可以重试。', retryable: true }
  }

  if (lower.includes('ffmpeg') || lower.includes('postprocess')) {
    return { code: 'postprocess', message: '下载完成后的媒体处理失败，请检查 ffmpeg 配置。', retryable: false }
  }

  return { code: 'unknown', message, retryable: true }
}

export class YtdlpRunError extends Error {
  readonly normalized: NormalizedYtdlpError
  readonly exitCode: number | null
  readonly stderr: string

  constructor(input: { normalized: NormalizedYtdlpError; exitCode: number | null; stderr: string }) {
    super(input.normalized.message)
    this.name = 'YtdlpRunError'
    this.normalized = input.normalized
    this.exitCode = input.exitCode
    this.stderr = input.stderr
  }
}

export class YtdlpToolNotFoundError extends Error {
  readonly attempts: string[]

  constructor(attempts: string[]) {
    super('未找到可用的 yt-dlp。')
    this.name = 'YtdlpToolNotFoundError'
    this.attempts = attempts
  }
}
