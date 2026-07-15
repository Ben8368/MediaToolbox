import { runTranscodeWorkerJob, type TranscodeWorkerJob } from '@mediatoolbox/transcode-worker'
import { FfmpegRunError, FfmpegToolNotFoundError } from '@mediatoolbox/ffmpeg'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'
import { addLog, nowSeconds } from './utils.js'
import { patchRunningJob, updateJobRecord } from './job-utils.js'

const activeAbortControllers = new Map<string, AbortController>()

export function abortTranscode(jobId: string): void {
  activeAbortControllers.get(jobId)?.abort()
  activeAbortControllers.delete(jobId)
}

export async function updateTranscodeJob(
  state: ApiState,
  jobId: string,
  nextStatus: Parameters<typeof updateJobRecord>[2],
  progress?: JobRecord['progress'],
  errorMessage?: string,
) {
  return updateJobRecord(state, jobId, nextStatus, {
    ...(progress ? { progress } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  })
}

function patchTranscodeProgress(state: ApiState, jobId: string, progress: JobRecord['progress']) {
  return progress ? patchRunningJob(state, jobId, { progress }) : Promise.resolve(false)
}

export async function executeTranscode(
  job: JobRecord,
  workerJob: TranscodeWorkerJob,
  state: ApiState,
  outputVirtualPath: string,
): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(job.id, controller)

  const started = await updateTranscodeJob(state, job.id, 'running')
  if (!started) return
  addLog(state.db, 'INFO', 'transcode', `开始转码：${job.title}`)

  try {
    const result = await runTranscodeWorkerJob(workerJob, {
      signal: controller.signal,
      onProgress: (progress) => {
        void patchTranscodeProgress(state, job.id, progress)
      },
      onLog: (line, stream) => {
        if (!line.trim()) return
        const level = stream === 'stderr' ? 'WARNING' : 'INFO'
        addLog(state.db, level, 'ffmpeg', `[${job.id}] ${line}`)
      },
    })

    activeAbortControllers.delete(job.id)

    if (result.status === 'canceled') {
      if (await updateTranscodeJob(state, job.id, 'canceled')) {
        addLog(state.db, 'WARNING', 'transcode', `转码已取消：${job.title}`)
      }
    } else {
      const completed = await updateTranscodeJob(state, job.id, 'succeeded', { current: 100, total: 100, unit: 'percent' })
      if (!completed) {
        await fs.unlink(workerJob.outputPath).catch(() => undefined)
        return
      }
      await state.db.assets.create({
        id: `asset-${job.id}`,
        kind: (workerJob.preset === 'audio-mp3' || workerJob.preset === 'audio-aac') ? 'audio' : 'video',
        name: outputVirtualPath.split('/').pop() || job.title,
        path: outputVirtualPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined)
      addLog(state.db, 'INFO', 'transcode', `转码完成：${job.title}`)
      if (result.vmafScore !== undefined) {
        addLog(state.db, 'INFO', 'transcode', `VMAF 分数：${result.vmafScore.toFixed(2)} — ${job.title}`)
      }
    }
  } catch (error) {
    activeAbortControllers.delete(job.id)

    if (error instanceof FfmpegToolNotFoundError) {
      if (await updateTranscodeJob(state, job.id, 'failed', undefined, '未找到可用的 ffmpeg，请确认已安装并在 PATH 中。')) {
        addLog(state.db, 'ERROR', 'transcode', `转码失败（ffmpeg 缺失）：${job.title}`)
      }
    } else if (error instanceof FfmpegRunError) {
      if (await updateTranscodeJob(state, job.id, 'failed', undefined, error.normalized.message)) {
        addLog(state.db, 'ERROR', 'transcode', `转码失败：${job.title} — ${error.normalized.message}`)
      }
    } else {
      const message = error instanceof Error ? error.message : String(error)
      if (await updateTranscodeJob(state, job.id, 'failed', undefined, message)) {
        addLog(state.db, 'ERROR', 'transcode', `转码出错：${job.title} — ${message}`)
      }
    }
  }
}
import fs from 'node:fs/promises'
