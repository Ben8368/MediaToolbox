export type DownloadMode = 'video' | 'audio' | 'subtitles'

export type YtdlpRequest = {
  url: string
  mode: DownloadMode
  outputTemplate: string
  subtitles?: {
    languages: string[]
    auto?: boolean
    format?: 'srt' | 'vtt'
  }
  cookiesFromBrowser?: 'chrome' | 'edge' | 'safari' | 'firefox'
  video?: {
    mergeOutputFormat?: 'mkv'
    recodeH264?: boolean
  }
}

export function buildYtdlpArgs(request: YtdlpRequest): string[] {
  const args = ['--newline', '--no-playlist', '--output', request.outputTemplate]

  if (request.mode === 'audio') {
    args.push('--extract-audio', '--audio-format', 'mp3')
  }

  if (request.mode === 'video' && request.video?.mergeOutputFormat) {
    args.push('--merge-output-format', request.video.mergeOutputFormat)
  }
  if (request.mode === 'video' && request.video?.recodeH264) {
    args.push('--recode-video', 'mp4')
  }

  if (request.mode === 'subtitles' || request.subtitles) {
    args.push('--write-subs')
    if (request.subtitles?.auto) args.push('--write-auto-subs')
    if (request.subtitles?.languages.length) {
      args.push('--sub-langs', request.subtitles.languages.join(','))
    }
    if (request.subtitles?.format) args.push('--convert-subs', request.subtitles.format)
  }

  if (request.cookiesFromBrowser) args.push('--cookies-from-browser', request.cookiesFromBrowser)

  args.push(request.url)
  return args
}
