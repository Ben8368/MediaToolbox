import { canTransitionJob, isTerminalJobStatus, transitionJob } from '@mediatoolbox/job-core'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'
import { revokeGrantsBoundToJob } from './workspace-path.js'

/**
 * 各 executor 与统一取消入口共享的 job 状态更新入口：
 * 查找 job、校验状态转移合法、执行转移写入 DB，并在进入终态时清理绑定的 PathGrant。
 */
export async function updateJobRecord(
  state: ApiState,
  jobId: string,
  nextStatus: Parameters<typeof transitionJob>[1],
  extras: Partial<Pick<JobRecord, 'progress' | 'errorMessage'>> = {},
): Promise<boolean> {
  const current = await state.db.jobs.findById(jobId)
  if (!current || !canTransitionJob(current.status, nextStatus)) return false
  const updated = await state.db.jobs.updateIfStatus({ ...transitionJob(current, nextStatus), ...extras }, current.status)
  if (!updated) return false
  if (isTerminalJobStatus(nextStatus)) await revokeGrantsBoundToJob(state, jobId)
  return true
}

/** 运行中进度、日志等字段更新不属于状态迁移；仅允许仍在运行的任务写入。 */
export async function patchRunningJob(
  state: ApiState,
  jobId: string,
  extras: Partial<Pick<JobRecord, 'progress' | 'errorMessage'>>,
): Promise<boolean> {
  return state.db.jobs.patchIfStatus(jobId, 'running', extras, Math.floor(Date.now() / 1000))
}
