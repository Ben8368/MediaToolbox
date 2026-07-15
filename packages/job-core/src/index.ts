import type { JobKind, JobRecord, JobStatus } from '@mediatoolbox/contracts'

const jobIdPrefixPattern = /^[a-z][a-z0-9-]{0,31}$/

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'failed', 'canceled'],
  running: ['paused', 'succeeded', 'failed', 'canceled'],
  paused: ['queued', 'running', 'failed', 'canceled'],
  succeeded: [],
  failed: ['queued'],
  canceled: [],
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return allowedTransitions[from].includes(to)
}

/**
 * 判断一个状态是否是"本次运行已经结束"，用于清理绑定资源（如 PathGrant）。
 * `failed` 是本次运行的终态；后续若引入重试，需要以新的调度策略显式创建或重入任务。
 */
export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled'
}

export function createJobId(prefix: string): string {
  if (!jobIdPrefixPattern.test(prefix)) throw new Error(`Invalid job ID prefix: ${prefix}`)
  return `${prefix}-${globalThis.crypto.randomUUID()}`
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
