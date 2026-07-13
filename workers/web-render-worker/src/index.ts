import fs from 'node:fs/promises'
import path from 'node:path'

import {
  resolveFfmpegTool,
  runFfmpeg,
  type FfmpegProgressEvent,
  type FfmpegRunResult,
  type ResolveFfmpegToolOptions,
} from '@mediatoolbox/ffmpeg'
import type { JobProgress } from '@mediatoolbox/contracts'

export type WebRenderVideoJob = {
  inputWebmPath: string
  outputMp4Path: string
  fps: number
  durationSeconds: number
  ffmpeg?: ResolveFfmpegToolOptions
}

export type WebRenderWorkerOptions = {
  signal?: AbortSignal
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
  onProgress?: (progress: JobProgress) => void
}

export function buildWebComposerFfmpegArgs(job: Pick<WebRenderVideoJob, 'inputWebmPath' | 'outputMp4Path' | 'fps'>): string[] {
  return [
    '-hide_banner',
    '-i', job.inputWebmPath,
    '-an',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-r', String(job.fps),
    job.outputMp4Path,
  ]
}

export async function persistWebComposerPng(buffer: Buffer, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)
}

export async function runWebRenderVideoJob(
  job: WebRenderVideoJob,
  options: WebRenderWorkerOptions = {},
): Promise<FfmpegRunResult> {
  await fs.mkdir(path.dirname(job.outputMp4Path), { recursive: true })
  const tool = await resolveFfmpegTool(job.ffmpeg)
  const handleEvent = (event: FfmpegProgressEvent) => {
    if (event.type === 'progress') {
      options.onProgress?.({ current: Math.round(event.percent * 10) / 10, total: 100, unit: 'percent' })
    }
  }
  return runFfmpeg({ inputPath: job.inputWebmPath, outputPath: job.outputMp4Path, preset: 'mp4-h264-aac' }, {
    command: tool.command,
    argsOverride: buildWebComposerFfmpegArgs(job),
    durationSeconds: job.durationSeconds,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onLog ? { onLog: options.onLog } : {}),
    onEvent: handleEvent,
  })
}
