import type { JobKind, JobRecord, JobStatus } from '@mediatoolbox/contracts'

const jobIdPrefixPattern = /^[a-z][a-z0-9-]{0,31}$/

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'failed', 'canceled'],
  running: ['queued', 'paused', 'succeeded', 'failed', 'canceled'],
  paused: ['queued', 'running', 'failed', 'canceled'],
  succeeded: [],
  failed: ['queued'],
  canceled: [],
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return allowedTransitions[from].includes(to)
}

/** 判断一个状态是否是整个任务的终态，用于清理绑定资源（如 PathGrant）。 */
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

export function startJobAttempt(job: JobRecord, now = new Date()): JobRecord {
  const started = transitionJob(job, 'running', now)
  delete started.nextAttemptAt
  delete started.progress
  delete started.errorMessage
  return {
    ...started,
    attempt: job.attempt + 1,
  }
}

export function retryDelaySeconds(attempt: number): number {
  return Math.min(60, 2 ** Math.max(0, attempt - 1))
}

export function scheduleJobRetry(job: JobRecord, errorMessage: string, now = new Date()): JobRecord {
  if (job.status !== 'running') throw new Error(`Cannot retry job in status: ${job.status}`)
  if (job.attempt >= job.maxAttempts) throw new Error(`Job retry attempts exhausted: ${job.id}`)
  const nowSec = Math.ceil(now.getTime() / 1000)
  return {
    ...transitionJob(job, 'queued', now),
    nextAttemptAt: nowSec + retryDelaySeconds(job.attempt),
    errorMessage,
  }
}

export function createJobRecord(input: { id: string; kind: JobKind; title: string; maxAttempts?: number; outputToken?: string; now?: Date }): JobRecord {
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const maxAttempts = Math.floor(input.maxAttempts ?? 1)
  if (maxAttempts < 1 || maxAttempts > 10) throw new Error(`Invalid max attempts: ${input.maxAttempts}`)

  return {
    id: input.id,
    kind: input.kind,
    status: 'queued',
    title: input.title,
    attempt: 0,
    maxAttempts,
    outputToken: input.outputToken ?? input.id,
    createdAt: nowSec,
    updatedAt: nowSec,
  }
}
