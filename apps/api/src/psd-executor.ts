import { runPsdWorkerJob, PsdWorkerEngineNotConfiguredError, PsdWorkerInputError } from '@mediatoolbox/psd-worker'
import type { JobRecord, WorkOrder } from '@mediatoolbox/contracts'

import { updateJobRecord } from './job-utils.js'
import type { ApiState } from './state.js'
import { addLog } from './utils.js'
import { revokeGrantsBoundToJob, toGrantMarker } from './workspace-path.js'

const activeAbortControllers = new Map<string, AbortController>()

export function abortPsdJob(jobId: string): void {
  activeAbortControllers.get(jobId)?.abort()
}

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError')
}

function psdErrorMessage(error: unknown): string {
  if (error instanceof PsdWorkerEngineNotConfiguredError) return 'Photoshop 命令未配置。'
  if (error instanceof PsdWorkerInputError) return error.message
  return error instanceof Error ? error.message : String(error)
}

export async function executePsdScan(
  job: JobRecord,
  psdPath: string,
  physicalPath: string,
  workOrderId: string,
  inputGrantId: string | undefined,
  state: ApiState,
): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(job.id, controller)
  let workOrderCreated = false
  let retainInputGrant = false

  try {
    const started = await updateJobRecord(state, job.id, 'running')
    if (!started) return
    addLog(state.db, 'INFO', 'psd', `开始 PSD 扫描：${job.title}`)

    const result = await runPsdWorkerJob(
      { type: 'scan', psdPath: physicalPath },
      undefined,
      { signal: controller.signal },
    )
    controller.signal.throwIfAborted()

    if (result.type === 'scan') {
      const workOrder: WorkOrder = {
        id: workOrderId,
        psdPath: inputGrantId ? toGrantMarker(inputGrantId) : (psdPath ?? physicalPath),
        psdFileName: physicalPath.split(/[\\/]/).pop() ?? 'unknown.psd',
        documentWidth: result.documentWidth,
        documentHeight: result.documentHeight,
        documentResolution: result.documentResolution,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        records: result.records,
      }
      await state.db.workOrders.create(workOrder)
      workOrderCreated = true
      controller.signal.throwIfAborted()

      const completed = await updateJobRecord(state, job.id, 'succeeded', { progress: { current: 100, total: 100, unit: 'percent' } })
      if (!completed) {
        await state.db.workOrders.delete(workOrderId)
        workOrderCreated = false
        return
      }
      retainInputGrant = true
      addLog(state.db, 'INFO', 'psd', `PSD 扫描完成：${workOrder.psdFileName}，${result.records.length} 个文字图层`)
    } else {
      throw new Error('Worker returned non-scan result')
    }
  } catch (error) {
    if (workOrderCreated) {
      await state.db.workOrders.delete(workOrderId)
      workOrderCreated = false
    }
    if (isAbortError(error, controller.signal)) {
      await updateJobRecord(state, job.id, 'canceled')
      addLog(state.db, 'WARNING', 'psd', `PSD 扫描已取消：${job.title}`)
    } else {
      const message = psdErrorMessage(error)
      await updateJobRecord(state, job.id, 'failed', { errorMessage: message })
      addLog(state.db, 'ERROR', 'psd', `PSD 扫描出错：${job.title} — ${message}`)
    }
  } finally {
    activeAbortControllers.delete(job.id)
    if (!retainInputGrant) await revokeGrantsBoundToJob(state, workOrderId)
  }
}

export async function executePsdApply(
  job: JobRecord,
  workOrder: WorkOrder,
  physicalPsdPath: string,
  physicalOutputPath: string,
  state: ApiState,
): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(job.id, controller)

  try {
    const started = await updateJobRecord(state, job.id, 'running')
    if (!started) return
    addLog(state.db, 'INFO', 'psd', `开始 PSD 应用：${job.title}`)

    const workOrderForApply: WorkOrder = { ...workOrder, psdPath: physicalPsdPath }
    const result = await runPsdWorkerJob({
      type: 'apply',
      workOrder: workOrderForApply,
      outputPsdPath: physicalOutputPath,
    }, undefined, { signal: controller.signal })
    controller.signal.throwIfAborted()

    if (result.type === 'apply') {
      const completed = await updateJobRecord(state, job.id, 'succeeded', { progress: { current: 100, total: 100, unit: 'percent' } })
      if (completed) addLog(state.db, 'INFO', 'psd', `PSD 应用完成：${workOrder.id}，${result.appliedCount} 个图层已应用`)
    } else {
      throw new Error('Worker returned non-apply result')
    }
  } catch (error) {
    if (isAbortError(error, controller.signal)) {
      await updateJobRecord(state, job.id, 'canceled')
      addLog(state.db, 'WARNING', 'psd', `PSD 应用已取消：${job.title}`)
    } else {
      const message = psdErrorMessage(error)
      await updateJobRecord(state, job.id, 'failed', { errorMessage: message })
      addLog(state.db, 'ERROR', 'psd', `PSD 应用出错：${job.title} — ${message}`)
    }
  } finally {
    activeAbortControllers.delete(job.id)
  }
}
