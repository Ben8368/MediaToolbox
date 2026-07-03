import {
  buildFfmpegArgs,
  resolveFfmpegTool,
  resolveFfprobeTool,
  probeMedia,
  runFfmpeg,
  getDurationSeconds,
  type ResolveFfmpegToolOptions,
  type TranscodeRequest,
  type FfmpegProgressEvent,
  type FfmpegRunResult,
} from '@mediatoolbox/ffmpeg'
import { transitionJob } from '@mediatoolbox/job-core'
import type { JobRecord, JobProgress } from '@mediatoolbox/contracts'

export type TranscodeWorkerJob = TranscodeRequest & {
  ffmpeg?: ResolveFfmpegToolOptions
  ffprobe?: ResolveFfmpegToolOptions
}

export type TranscodeWorkerRunOptions = {
  signal?: AbortSignal
  onEvent?: (event: FfmpegProgressEvent) => void
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
  onProgress?: (progress: JobProgress) => void
}

export type TranscodeWorkerResult = FfmpegRunResult & {
  durationSeconds?: number
}

export function describeTranscodeWorker() {
  return {
    name: 'transcode-worker',
    commandPreview: buildFfmpegArgs({
      inputPath: 'input.mov',
      outputPath: 'output.mp4',
      preset: 'mp4-h264-aac',
    }),
  }
}

export async function runTranscodeWorkerJob(
  job: TranscodeWorkerJob,
  options: TranscodeWorkerRunOptions = {},
): Promise<TranscodeWorkerResult> {
  const ffmpegTool = await resolveFfmpegTool(job.ffmpeg)
  const ffprobeTool = await resolveFfprobeTool(job.ffprobe)

  const probeResult = await probeMedia(job.inputPath, {
    command: ffprobeTool.command,
    ...(options.signal ? { signal: options.signal } : {}),
  })
  const durationSeconds = getDurationSeconds(probeResult)

  const result = await runFfmpeg(job, {
    command: ffmpegTool.command,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    onEvent(event) {
      if (event.type === 'progress' && options.onProgress) {
        options.onProgress({
          current: Math.round(event.percent * 10) / 10,
          total: 100,
          unit: 'percent',
        })
      }
      options.onEvent?.(event)
    },
    ...(options.onLog ? { onLog: options.onLog } : {}),
  })

  return { ...result, ...(durationSeconds !== undefined ? { durationSeconds } : {}) }
}

export function applyTranscodeResult(
  job: JobRecord,
  result: TranscodeWorkerResult,
  now?: Date,
): JobRecord {
  const nextStatus = result.status === 'succeeded' ? 'succeeded' : 'canceled'
  return transitionJob(job, nextStatus, now)
}
