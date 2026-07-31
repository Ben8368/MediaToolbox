import fs from 'node:fs/promises'
import path from 'node:path'

import { runTranscodeWorkerJob, type TranscodeWorkerJob } from '@mediatoolbox/transcode-worker'
import { FfmpegRunError, FfmpegToolNotFoundError } from '@mediatoolbox/ffmpeg'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'
import { addLog } from './utils.js'
import { deferJobRetry, patchRunningJob, startJobExecution, updateJobRecord, waitForDeferredJob } from './job-utils.js'

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

function outputStagingPaths(outputPath: string, outputToken: string) {
  const parsed = path.parse(outputPath)
  const suffix = outputToken.replace(/[^a-zA-Z0-9_-]/g, '_')
  return {
    temporaryPath: path.join(parsed.dir, `.${parsed.name}.${suffix}.partial${parsed.ext}`),
    backupPath: path.join(parsed.dir, `.${parsed.name}.${suffix}.backup${parsed.ext}`),
  }
}

async function restorePreviousOutput(outputPath: string, backupPath: string, hasBackup: boolean): Promise<void> {
  await fs.unlink(outputPath).catch(() => undefined)
  if (hasBackup) await fs.rename(backupPath, outputPath)
}

export async function executeTranscode(
  job: JobRecord,
  workerJob: TranscodeWorkerJob,
  state: ApiState,
  outputVirtualPath: string,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    if (await updateTranscodeJob(state, job.id, 'canceled')) {
      addLog(state.db, 'WARNING', 'transcode', `转码已取消：${job.title}`)
    }
    return
  }
  const runningJob = await startJobExecution(state, job.id)
  if (!runningJob) return
  addLog(state.db, 'INFO', 'transcode', `开始转码（${runningJob.attempt}/${runningJob.maxAttempts}）：${job.title}`)
  let retainOutput = false
  let outputCommitted = false
  let hasBackup = false
  let deferredJob: JobRecord | undefined
  const { temporaryPath, backupPath } = outputStagingPaths(workerJob.outputPath, runningJob.outputToken)

  try {
    await Promise.all([
      fs.unlink(temporaryPath).catch(() => undefined),
      fs.unlink(backupPath).catch(() => undefined),
    ])
    const result = await runTranscodeWorkerJob({ ...workerJob, outputPath: temporaryPath }, {
      signal,
      onProgress: (progress) => {
        void patchTranscodeProgress(state, job.id, progress)
      },
      onLog: (line, stream) => {
        if (!line.trim()) return
        const level = stream === 'stderr' ? 'WARNING' : 'INFO'
        addLog(state.db, level, 'ffmpeg', `[${job.id}] ${line}`)
      },
    })

    if (result.status === 'canceled') {
      if (await updateTranscodeJob(state, job.id, 'canceled')) {
        addLog(state.db, 'WARNING', 'transcode', `转码已取消：${job.title}`)
      }
    } else {
      try {
        const existing = await fs.stat(workerJob.outputPath)
        if (!existing.isFile()) throw new Error('输出路径已存在且不是文件。')
        await fs.rename(workerJob.outputPath, backupPath)
        hasBackup = true
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      }
      try {
        await fs.rename(temporaryPath, workerJob.outputPath)
      } catch (error) {
        if (hasBackup) {
          await fs.rename(backupPath, workerJob.outputPath)
          hasBackup = false
        }
        throw error
      }
      outputCommitted = true
      const completed = await updateTranscodeJob(state, job.id, 'succeeded', { current: 100, total: 100, unit: 'percent' })
      if (!completed) return
      retainOutput = true
      if (hasBackup) await fs.unlink(backupPath).catch(() => undefined)
      await state.db.assets.create({
        id: `asset-${job.id}`,
        kind: (workerJob.preset === 'audio-mp3' || workerJob.preset === 'audio-aac') ? 'audio' : 'video',
        name: outputVirtualPath.split('/').pop() || job.title,
        path: outputVirtualPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).catch((error) => {
        addLog(state.db, 'WARNING', 'transcode', `转码产物已生成，但资产索引写入失败：${error instanceof Error ? error.message : String(error)}`)
      })
      addLog(state.db, 'INFO', 'transcode', `转码完成：${job.title}`)
      if (result.vmafScore !== undefined) {
        addLog(state.db, 'INFO', 'transcode', `VMAF 分数：${result.vmafScore.toFixed(2)} — ${job.title}`)
      }
    }
  } catch (error) {
    if (signal.aborted) {
      if (await updateTranscodeJob(state, job.id, 'canceled')) {
        addLog(state.db, 'WARNING', 'transcode', `转码已取消：${job.title}`)
      }
    } else if (error instanceof FfmpegToolNotFoundError) {
      if (await updateTranscodeJob(state, job.id, 'failed', undefined, '未找到可用的 ffmpeg，请确认已安装并在 PATH 中。')) {
        addLog(state.db, 'ERROR', 'transcode', `转码失败（ffmpeg 缺失）：${job.title}`)
      }
    } else if (error instanceof FfmpegRunError) {
      if (error.normalized.retryable) deferredJob = await deferJobRetry(state, job.id, error.normalized.message)
      if (deferredJob) {
        addLog(state.db, 'WARNING', 'transcode', `转码暂时失败，将自动重试：${job.title} — ${error.normalized.message}`)
      } else if (await updateTranscodeJob(state, job.id, 'failed', undefined, error.normalized.message)) {
        addLog(state.db, 'ERROR', 'transcode', `转码失败：${job.title} — ${error.normalized.message}`)
      }
    } else {
      const message = error instanceof Error ? error.message : String(error)
      if (await updateTranscodeJob(state, job.id, 'failed', undefined, message)) {
        addLog(state.db, 'ERROR', 'transcode', `转码出错：${job.title} — ${message}`)
      }
    }
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined)
    if (outputCommitted && !retainOutput) {
      await restorePreviousOutput(workerJob.outputPath, backupPath, hasBackup).catch(() => undefined)
    }
    if (retainOutput || !hasBackup) await fs.unlink(backupPath).catch(() => undefined)
  }

  if (deferredJob) {
    if (await waitForDeferredJob(deferredJob, signal)) {
      await executeTranscode(job, workerJob, state, outputVirtualPath, signal)
    } else if (await updateTranscodeJob(state, job.id, 'canceled')) {
      addLog(state.db, 'WARNING', 'transcode', `转码已取消：${job.title}`)
    }
  }
}
