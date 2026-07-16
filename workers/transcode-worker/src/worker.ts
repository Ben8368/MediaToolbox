import {
  buildFfmpegArgs,
  buildTwoPassFfmpegArgs,
  resolveFfmpegTool,
  resolveFfprobeTool,
  probeMedia,
  runFfmpeg,
  runVmafComparison,
  getDurationSeconds,
  type ResolveFfmpegToolOptions,
  type TranscodeRequest,
  type FfmpegProgressEvent,
  type FfmpegRunResult,
} from '@mediatoolbox/ffmpeg'
import { transitionJob } from '@mediatoolbox/job-core'
import type { JobRecord, JobProgress } from '@mediatoolbox/contracts'
import fs from 'node:fs/promises'

export type TranscodeWorkerJob = TranscodeRequest & {
  ffmpeg?: ResolveFfmpegToolOptions
  ffprobe?: ResolveFfmpegToolOptions
  enableVmaf?: boolean
}

export type TranscodeWorkerRunOptions = {
  signal?: AbortSignal
  onEvent?: (event: FfmpegProgressEvent) => void
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
  onProgress?: (progress: JobProgress) => void
}

export type TranscodeWorkerResult = FfmpegRunResult & {
  durationSeconds?: number
  vmafScore?: number
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

const TWO_PASS_PRESETS = new Set<TranscodeRequest['preset']>(['mp4-h264-aac', 'mp4-h265-aac', 'mkv-h265-aac'])

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

  const handleEvent = (event: FfmpegProgressEvent) => {
    if (event.type === 'progress' && options.onProgress) {
      options.onProgress({
        current: Math.round(event.percent * 10) / 10,
        total: 100,
        unit: 'percent',
      })
    }
    options.onEvent?.(event)
  }

  let result: FfmpegRunResult
  if (job.targetBitrateKbps && TWO_PASS_PRESETS.has(job.preset)) {
    const passLogFile = `${job.outputPath}.ffmpeg2pass`
    try {
      await runFfmpeg(job, {
        command: ffmpegTool.command,
        argsOverride: buildTwoPassFfmpegArgs(job, 1, passLogFile),
        ...(options.signal ? { signal: options.signal } : {}),
      })
      result = await runFfmpeg(job, {
        command: ffmpegTool.command,
        argsOverride: buildTwoPassFfmpegArgs(job, 2, passLogFile),
        ...(options.signal ? { signal: options.signal } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        onEvent: handleEvent,
        ...(options.onLog ? { onLog: options.onLog } : {}),
      })
    } finally {
      await cleanupTwoPassFiles(passLogFile)
    }
  } else {
    result = await runFfmpeg(job, {
      command: ffmpegTool.command,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      onEvent: handleEvent,
      ...(options.onLog ? { onLog: options.onLog } : {}),
    })
  }

  let vmafScore: number | undefined
  if (result.status === 'succeeded' && job.enableVmaf) {
    try {
      const vmafResult = await runVmafComparison(job.inputPath, job.outputPath, { command: ffmpegTool.command })
      vmafScore = vmafResult.vmafScore
    } catch (error) {
      // best-effort quality check；VMAF 失败不应让转码任务失败，但必须让调用方看到，不能静默吞掉。
      const message = error instanceof Error ? error.message : String(error)
      options.onLog?.(`VMAF comparison failed: ${message}`, 'stderr')
    }
  }

  return {
    ...result,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(vmafScore !== undefined ? { vmafScore } : {}),
  }
}

async function cleanupTwoPassFiles(passLogFile: string): Promise<void> {
  await Promise.all([
    `${passLogFile}-0.log`,
    `${passLogFile}-0.log.mbtree`,
    `${passLogFile}-0.log.cutree`,
  ].map((file) => fs.unlink(file).catch(() => undefined)))
}

export function applyTranscodeResult(
  job: JobRecord,
  result: TranscodeWorkerResult,
  now?: Date,
): JobRecord {
  const nextStatus = result.status === 'succeeded' ? 'succeeded' : 'canceled'
  return transitionJob(job, nextStatus, now)
}
