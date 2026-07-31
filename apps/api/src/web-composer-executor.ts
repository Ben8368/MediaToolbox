import fs from 'node:fs/promises'

import { persistWebComposerPng, runWebRenderVideoJob } from '@mediatoolbox/web-render-worker'
import type { JobRecord } from '@mediatoolbox/contracts'
import type { WebComposerVideoFormat } from '@mediatoolbox/contracts'

import { patchRunningJob, startJobExecution, updateJobRecord } from './job-utils.js'
import type { ApiState } from './state.js'
import { addLog } from './utils.js'

export type WebComposerCaptureJob = {
  kind: 'png' | 'webm'
  capture: Buffer
  physicalOutputPath: string
  virtualOutputPath: string
  physicalInputPath?: string
  fps?: number
  durationSeconds?: number
  videoFormat?: WebComposerVideoFormat
}

async function addOutputAsset(state: ApiState, job: JobRecord, capture: WebComposerCaptureJob) {
  const now = new Date().toISOString()
  await state.db.assets.create({
    id: `asset-${job.id}`,
    kind: capture.kind === 'png' ? 'image' : 'video',
    name: capture.virtualOutputPath.split('/').pop() || job.title,
    path: capture.virtualOutputPath,
    mimeType: capture.kind === 'png' ? 'image/png' : capture.videoFormat === 'mov-alpha' ? 'video/quicktime' : 'video/mp4',
    createdAt: now,
    updatedAt: now,
  })
}

export async function executeWebComposerCapture(
  job: JobRecord,
  capture: WebComposerCaptureJob,
  state: ApiState,
  signal: AbortSignal,
): Promise<void> {
  const started = await startJobExecution(state, job.id)
  if (!started) return
  await patchRunningJob(state, job.id, { progress: { current: 0, total: 100, unit: 'percent' } })
  addLog(state.db, 'INFO', 'web-composer', `开始导出：${job.title}`)
  let retainOutput = false

  try {
    if (capture.kind === 'png') {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      await persistWebComposerPng(capture.capture, capture.physicalOutputPath)
    } else {
      if (!capture.physicalInputPath || !capture.fps || !capture.durationSeconds || !capture.videoFormat) {
        throw new Error('视频导出参数不完整。')
      }
      await fs.writeFile(capture.physicalInputPath, capture.capture)
      const result = await runWebRenderVideoJob({
        inputWebmPath: capture.physicalInputPath,
        outputPath: capture.physicalOutputPath,
        fps: capture.fps,
        durationSeconds: capture.durationSeconds,
        videoFormat: capture.videoFormat,
      }, {
        signal,
        onProgress: (progress) => {
          void patchRunningJob(state, job.id, { progress })
        },
        onLog: (line, stream) => {
          if (line.trim()) addLog(state.db, stream === 'stderr' ? 'WARNING' : 'INFO', 'web-render', `[${job.id}] ${line}`)
        },
      })
      if (result.status === 'canceled') {
        if (await updateJobRecord(state, job.id, 'canceled')) {
          addLog(state.db, 'WARNING', 'web-composer', `导出已取消：${job.title}`)
        }
        return
      }
    }

    if (signal.aborted) {
      await updateJobRecord(state, job.id, 'canceled')
      await fs.unlink(capture.physicalOutputPath).catch(() => undefined)
      return
    }
    const completed = await updateJobRecord(state, job.id, 'succeeded', { progress: { current: 100, total: 100, unit: 'percent' } })
    if (!completed) return
    retainOutput = true
    await addOutputAsset(state, job, capture).catch((error) => {
      addLog(state.db, 'WARNING', 'web-composer', `导出产物已生成，但资产索引写入失败：${error instanceof Error ? error.message : String(error)}`)
    })
    addLog(state.db, 'INFO', 'web-composer', `导出完成：${capture.virtualOutputPath}`)
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      if (await updateJobRecord(state, job.id, 'canceled')) {
        addLog(state.db, 'WARNING', 'web-composer', `导出已取消：${job.title}`)
      }
    } else {
      const message = error instanceof Error ? error.message : String(error)
      if (await updateJobRecord(state, job.id, 'failed', { errorMessage: message })) {
        addLog(state.db, 'ERROR', 'web-composer', `导出失败：${job.title} — ${message}`)
      }
    }
  } finally {
    if (capture.physicalInputPath) await fs.unlink(capture.physicalInputPath).catch(() => undefined)
    if (!retainOutput) await fs.unlink(capture.physicalOutputPath).catch(() => undefined)
  }
}
