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

export function transitionJob(job: JobRecord, nextStatus: JobStatus, now = new Date()): JobRecord {
  if (!canTransitionJob(job.status, nextStatus)) {
    throw new Error(`Invalid job transition: ${job.status} -> ${nextStatus}`)
  }

  return {
    ...job,
    status: nextStatus,
    updatedAt: now.toISOString(),
  }
}

export function createJobRecord(input: { id: string; kind: JobKind; title: string; now?: Date }): JobRecord {
  const now = (input.now ?? new Date()).toISOString()

  return {
    id: input.id,
    kind: input.kind,
    status: 'queued',
    title: input.title,
    createdAt: now,
    updatedAt: now,
  }
}
