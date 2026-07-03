import { buildYtdlpArgs } from '@mediatoolbox/downloader'

export function describeDownloadWorker() {
  return {
    name: 'download-worker',
    commandPreview: buildYtdlpArgs({
      url: 'https://example.com/video',
      mode: 'video',
      outputTemplate: '%(title)s.%(ext)s',
    }),
  }
}
