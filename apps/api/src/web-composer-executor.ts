import fs from 'node:fs/promises'

import { canTransitionJob, transitionJob } from '@mediatoolbox/job-core'
import { persistWebComposerPng, runWebRenderVideoJob } from '@mediatoolbox/web-render-worker'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'
import { addLog } from './utils.js'

const activeAbortControllers = new Map<string, AbortController>()

export type WebComposerCaptureJob = {
  kind: 'png' | 'webm'
  capture: Buffer
  physicalOutputPath: string
  virtualOutputPath: string
  physicalInputPath?: string
  fps?: number
  durationSeconds?: number
}

export function abortWebComposerRender(jobId: string): void {
  activeAbortControllers.get(jobId)?.abort()
  activeAbortControllers.delete(jobId)
}

async function updateJob(
  state: ApiState,
  jobId: string,
  nextStatus: Parameters<typeof transitionJob>[1],
  extras: Pick<JobRecord, 'progress' | 'errorMessage'> = {},
) {
  const current = await state.db.jobs.findById(jobId)
  if (!current || !canTransitionJob(current.status, nextStatus)) return
  await state.db.jobs.update({ ...transitionJob(current, nextStatus), ...extras })
}

async function addOutputAsset(state: ApiState, job: JobRecord, capture: WebComposerCaptureJob) {
  const now = new Date().toISOString()
  await state.db.assets.create({
    id: `asset-${job.id}`,
    kind: capture.kind === 'png' ? 'image' : 'video',
    name: capture.virtualOutputPath.split('/').pop() || job.title,
    path: capture.virtualOutputPath,
    mimeType: capture.kind === 'png' ? 'image/png' : 'video/mp4',
    createdAt: now,
    updatedAt: now,
  })
}

export async function executeWebComposerCapture(job: JobRecord, capture: WebComposerCaptureJob, state: ApiState): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(job.id, controller)
  await updateJob(state, job.id, 'running', { progress: { current: 0, total: 100, unit: 'percent' } })
  addLog(state.db, 'INFO', 'web-composer', `开始导出：${job.title}`)

  try {
    if (capture.kind === 'png') {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      await persistWebComposerPng(capture.capture, capture.physicalOutputPath)
    } else {
      if (!capture.physicalInputPath || !capture.fps || !capture.durationSeconds) {
        throw new Error('视频导出参数不完整。')
      }
      await fs.writeFile(capture.physicalInputPath, capture.capture)
      const result = await runWebRenderVideoJob({
        inputWebmPath: capture.physicalInputPath,
        outputMp4Path: capture.physicalOutputPath,
        fps: capture.fps,
        durationSeconds: capture.durationSeconds,
      }, {
        signal: controller.signal,
        onProgress: (progress) => {
          void updateJob(state, job.id, 'running', { progress })
        },
        onLog: (line, stream) => {
          if (line.trim()) addLog(state.db, stream === 'stderr' ? 'WARNING' : 'INFO', 'web-render', `[${job.id}] ${line}`)
        },
      })
      if (result.status === 'canceled') {
        await updateJob(state, job.id, 'canceled')
        addLog(state.db, 'WARNING', 'web-composer', `导出已取消：${job.title}`)
        return
      }
    }

    if (controller.signal.aborted) {
      await updateJob(state, job.id, 'canceled')
      return
    }
    await addOutputAsset(state, job, capture)
    await updateJob(state, job.id, 'succeeded', { progress: { current: 100, total: 100, unit: 'percent' } })
    addLog(state.db, 'INFO', 'web-composer', `导出完成：${capture.virtualOutputPath}`)
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      await updateJob(state, job.id, 'canceled')
      addLog(state.db, 'WARNING', 'web-composer', `导出已取消：${job.title}`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      await updateJob(state, job.id, 'failed', { errorMessage: message })
      addLog(state.db, 'ERROR', 'web-composer', `导出失败：${job.title} — ${message}`)
    }
  } finally {
    activeAbortControllers.delete(job.id)
    if (capture.physicalInputPath) await fs.unlink(capture.physicalInputPath).catch(() => undefined)
  }
}
