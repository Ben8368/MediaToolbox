import { transitionJob } from '@mediatoolbox/job-core'

import type { ApiState } from './state.js'
import { formatLogTime } from './utils.js'
import { revokeGrantsBoundToJob } from './workspace-path.js'

const interruptedStatuses = new Set(['queued', 'running', 'paused'])
export const INTERRUPTED_JOB_MESSAGE = 'API 重启导致任务中断；该执行器尚不支持断点恢复，请重新提交任务。'

export async function recoverInterruptedJobs(state: ApiState): Promise<number> {
  const jobs = await state.db.jobs.list()
  const interruptedJobs = jobs.filter((job) => interruptedStatuses.has(job.status))

  let recoveredCount = 0
  for (const job of interruptedJobs) {
    const failedJob = {
      ...transitionJob(job, 'failed'),
      errorMessage: INTERRUPTED_JOB_MESSAGE,
    }
    const updated = await state.db.jobs.updateIfStatus(failedJob, job.status)
    if (!updated) continue
    recoveredCount += 1

    await revokeGrantsBoundToJob(state, job.id)
    await state.db.logs.create({
      level: 'WARNING',
      module: 'jobs',
      time: formatLogTime(),
      user: 'api',
      event: '恢复中断任务',
      message: `任务 ${job.id}（${job.title}）因 API 重启被标记为失败。`,
    })
  }

  return recoveredCount
}
