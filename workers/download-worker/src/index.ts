import {
  buildYtdlpArgs,
  resolveYtdlpTool,
  runYtdlpDownload,
  type ResolveYtdlpToolOptions,
  type YtdlpProgressEvent,
  type YtdlpRequest,
  type YtdlpRunOptions,
  type YtdlpRunResult,
} from '@mediatoolbox/downloader'

export type DownloadWorkerJob = YtdlpRequest & {
  ytdlp?: ResolveYtdlpToolOptions
}

export type DownloadWorkerRunOptions = {
  signal?: AbortSignal
  onEvent?: (event: YtdlpProgressEvent) => void
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
}

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

export async function runDownloadWorkerJob(job: DownloadWorkerJob, options: DownloadWorkerRunOptions = {}): Promise<YtdlpRunResult> {
  const tool = await resolveYtdlpTool(job.ytdlp)
  const runOptions: YtdlpRunOptions = {
    command: tool.command,
  }
  if (options.signal) runOptions.signal = options.signal
  if (options.onEvent) runOptions.onEvent = options.onEvent
  if (options.onLog) runOptions.onLog = options.onLog
  return runYtdlpDownload(job, runOptions)
}
