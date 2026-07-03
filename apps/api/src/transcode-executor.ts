import { runTranscodeWorkerJob, type TranscodeWorkerJob } from '@mediatoolbox/transcode-worker'
import { FfmpegRunError, FfmpegToolNotFoundError } from '@mediatoolbox/ffmpeg'
import { transitionJob, canTransitionJob } from '@mediatoolbox/job-core'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'
import { addLog, nowSeconds } from './utils.js'

const activeAbortControllers = new Map<string, AbortController>()

export function abortTranscode(jobId: string): void {
  activeAbortControllers.get(jobId)?.abort()
  activeAbortControllers.delete(jobId)
}

export function updateTranscodeJob(
  state: ApiState,
  jobId: string,
  nextStatus: Parameters<typeof transitionJob>[1],
  progress?: JobRecord['progress'],
) {
  const idx = state.jobs.findIndex((j) => j.id === jobId)
  if (idx < 0) return
  const job = state.jobs[idx]!
  if (!canTransitionJob(job.status, nextStatus)) return
  const updated = transitionJob(job, nextStatus)
  state.jobs[idx] = progress ? { ...updated, progress } : updated
}

export async function executeTranscode(job: JobRecord, workerJob: TranscodeWorkerJob, state: ApiState): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(job.id, controller)

  updateTranscodeJob(state, job.id, 'running')
  addLog(state, 'INFO', 'transcode', `开始转码：${job.title}`)

  try {
    const result = await runTranscodeWorkerJob(workerJob, {
      signal: controller.signal,
      onProgress: (progress) => {
        updateTranscodeJob(state, job.id, 'running', progress)
      },
      onLog: (line, stream) => {
        if (!line.trim()) return
        const level = stream === 'stderr' ? 'WARNING' : 'INFO'
        addLog(state, level, 'ffmpeg', `[${job.id}] ${line}`)
      },
    })

    activeAbortControllers.delete(job.id)

    if (result.status === 'canceled') {
      updateTranscodeJob(state, job.id, 'canceled')
      addLog(state, 'WARNING', 'transcode', `转码已取消：${job.title}`)
    } else {
      updateTranscodeJob(state, job.id, 'succeeded', { current: 100, total: 100, unit: 'percent' })
      addLog(state, 'INFO', 'transcode', `转码完成：${job.title}`)
    }
  } catch (error) {
    activeAbortControllers.delete(job.id)

    if (error instanceof FfmpegToolNotFoundError) {
      updateTranscodeJob(state, job.id, 'failed')
      addLog(state, 'ERROR', 'transcode', `转码失败（ffmpeg 缺失）：${job.title}`)
    } else if (error instanceof FfmpegRunError) {
      updateTranscodeJob(state, job.id, 'failed')
      addLog(state, 'ERROR', 'transcode', `转码失败：${job.title} — ${error.normalized.message}`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      updateTranscodeJob(state, job.id, 'failed')
      addLog(state, 'ERROR', 'transcode', `转码出错：${job.title} — ${message}`)
    }
  }
}
