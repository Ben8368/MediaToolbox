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
  await state.db.jobs.update({ ...transitionJob(current, nextStatus), ...extras })
  if (isTerminalJobStatus(nextStatus)) await revokeGrantsBoundToJob(state, jobId)
  return true
}
