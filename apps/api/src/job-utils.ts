import { canTransitionJob, isTerminalJobStatus, scheduleJobRetry, startJobAttempt, transitionJob } from '@mediatoolbox/job-core'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'
import { revokeGrantsBoundToJob } from './workspace-path.js'

type JobUpdateOptions = {
  /**
   * 默认在任务进入终态时吊销绑定授权。仅当成功结果会继续持有该授权的持久实体复用时关闭，
   * 例如 PSD scan 成功后由同 ID 的 WorkOrder 持有输入授权，直到 apply 完成。
   */
  revokeGrantsOnTerminal?: boolean
}

/**
 * 各 executor 与统一取消入口共享的 job 状态更新入口：
 * 查找 job、校验状态转移合法、执行转移写入 DB，并默认在进入终态时清理绑定的 PathGrant。
 */
export async function updateJobRecord(
  state: ApiState,
  jobId: string,
  nextStatus: Parameters<typeof transitionJob>[1],
  extras: Partial<Pick<JobRecord, 'progress' | 'errorMessage'>> = {},
  options: JobUpdateOptions = {},
): Promise<boolean> {
  const current = await state.db.jobs.findById(jobId)
  if (!current || !canTransitionJob(current.status, nextStatus)) return false
  const nextRecord = { ...transitionJob(current, nextStatus), ...extras }
  if (isTerminalJobStatus(nextStatus)) delete nextRecord.nextAttemptAt
  const updated = await state.db.jobs.updateIfStatus(nextRecord, current.status)
  if (!updated) return false
  if (isTerminalJobStatus(nextStatus) && options.revokeGrantsOnTerminal !== false) {
    await revokeGrantsBoundToJob(state, jobId)
  }
  return true
}

/** 原子开始一次执行并增加 attempt；用于支持重试的 executor。 */
export async function startJobExecution(state: ApiState, jobId: string): Promise<JobRecord | undefined> {
  const current = await state.db.jobs.findById(jobId)
  if (!current || current.status !== 'queued') return undefined
  const nowSec = Math.floor(Date.now() / 1000)
  if (current.nextAttemptAt !== undefined && current.nextAttemptAt > nowSec) return undefined
  const started = startJobAttempt(current)
  return await state.db.jobs.updateIfStatus(started, 'queued') ? started : undefined
}

/**
 * 将明确可重试的运行错误放回 queued，并持久化下一次执行时间。
 * 返回 undefined 表示次数耗尽或任务已被并发取消。
 */
export async function deferJobRetry(
  state: ApiState,
  jobId: string,
  errorMessage: string,
): Promise<JobRecord | undefined> {
  const current = await state.db.jobs.findById(jobId)
  if (!current || current.status !== 'running' || current.attempt >= current.maxAttempts) return undefined
  const deferred = scheduleJobRetry(current, errorMessage)
  return await state.db.jobs.updateIfStatus(deferred, 'running') ? deferred : undefined
}

/** 等待持久化的重试时间；取消或关闭 executor 时立即结束等待。 */
export async function waitForDeferredJob(job: JobRecord, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false
  const waitMs = Math.max(0, (job.nextAttemptAt ?? Math.floor(Date.now() / 1000)) * 1000 - Date.now())
  if (waitMs === 0) return true
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(true)
    }, waitMs)
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** 运行中进度、日志等字段更新不属于状态迁移；仅允许仍在运行的任务写入。 */
export async function patchRunningJob(
  state: ApiState,
  jobId: string,
  extras: Partial<Pick<JobRecord, 'progress' | 'errorMessage'>>,
): Promise<boolean> {
  return state.db.jobs.patchIfStatus(jobId, 'running', extras, Math.floor(Date.now() / 1000))
}
