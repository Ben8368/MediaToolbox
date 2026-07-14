import type { JobKind, JobRecord, JobStatus } from '@mediatoolbox/contracts'

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'canceled'],
  running: ['paused', 'succeeded', 'failed', 'retrying', 'canceled'],
  paused: ['queued', 'running', 'canceled'],
  retrying: ['queued', 'running', 'failed', 'canceled'],
  succeeded: [],
  failed: ['queued'],
  canceled: [],
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return allowedTransitions[from].includes(to)
}

/**
 * 判断一个状态是否是"本次运行已经结束"，用于清理绑定资源（如 PathGrant）。
 * 注意：`failed` 状态在状态机里允许转回 `queued`（预留重试路径），
 * 但当前没有任何代码真正实现这条重试路径，所以在资源清理语境下仍视为终态。
 */
export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled'
}

export function transitionJob(job: JobRecord, nextStatus: JobStatus, now = new Date()): JobRecord {
  if (!canTransitionJob(job.status, nextStatus)) {
    throw new Error(`Invalid job transition: ${job.status} -> ${nextStatus}`)
  }

  return {
    ...job,
    status: nextStatus,
    updatedAt: Math.floor(now.getTime() / 1000),
  }
}

export function createJobRecord(input: { id: string; kind: JobKind; title: string; now?: Date }): JobRecord {
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000)

  return {
    id: input.id,
    kind: input.kind,
    status: 'queued',
    title: input.title,
    createdAt: nowSec,
    updatedAt: nowSec,
  }
}
