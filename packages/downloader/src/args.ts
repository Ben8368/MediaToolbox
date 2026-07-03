export type DownloadMode = 'video' | 'audio' | 'subtitles'

export type YtdlpRequest = {
  url: string
  mode: DownloadMode
  outputTemplate: string
  subtitles?: {
    languages: string[]
    auto?: boolean
  }
}

export function buildYtdlpArgs(request: YtdlpRequest): string[] {
  const args = ['--newline', '--no-playlist', '--output', request.outputTemplate]

  if (request.mode === 'audio') {
    args.push('--extract-audio', '--audio-format', 'mp3')
  }

  if (request.mode === 'subtitles' || request.subtitles) {
    args.push('--write-subs')
    if (request.subtitles?.auto) args.push('--write-auto-subs')
    if (request.subtitles?.languages.length) {
      args.push('--sub-langs', request.subtitles.languages.join(','))
    }
  }

  args.push(request.url)
  return args
}
