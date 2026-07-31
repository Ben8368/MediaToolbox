import { describe, expect, it } from 'vitest'
import { canTransitionJob, createJobId, createJobRecord, retryDelaySeconds, scheduleJobRetry, startJobAttempt, transitionJob } from './index.js'

describe('job state machine', () => {
  it('creates queued jobs', () => {
    const job = createJobRecord({ id: 'job-1', kind: 'download.video', title: 'Example' })
    expect(job).toMatchObject({ status: 'queued', attempt: 0, maxAttempts: 1, outputToken: 'job-1' })
  })

  it('allows queued jobs to start', () => {
    expect(canTransitionJob('queued', 'running')).toBe(true)
  })

  it('rejects impossible transitions', () => {
    const job = createJobRecord({ id: 'job-1', kind: 'download.video', title: 'Example' })
    expect(() => transitionJob(job, 'succeeded')).toThrow(/Invalid job transition/)
  })

  it('creates collision-resistant IDs independently of wall-clock time', () => {
    const ids = Array.from({ length: 100 }, () => createJobId('transcode'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^transcode-[0-9a-f-]{36}$/.test(id))).toBe(true)
  })

  it('allows active jobs to fail when their execution process is lost', () => {
    expect(canTransitionJob('queued', 'failed')).toBe(true)
    expect(canTransitionJob('paused', 'failed')).toBe(true)
  })

  it('tracks attempts and schedules bounded exponential retries', () => {
    const created = createJobRecord({ id: 'job-1', kind: 'download.video', title: 'Example', maxAttempts: 3 })
    const firstAttempt = startJobAttempt(created, new Date(1_000))
    const retry = scheduleJobRetry(firstAttempt, 'network timeout', new Date(2_000))

    expect(firstAttempt).toMatchObject({ status: 'running', attempt: 1 })
    expect(retry).toMatchObject({ status: 'queued', attempt: 1, nextAttemptAt: 3, errorMessage: 'network timeout' })
    expect(startJobAttempt(retry, new Date(3_000))).toMatchObject({ status: 'running', attempt: 2, outputToken: 'job-1' })
    expect(retryDelaySeconds(10)).toBe(60)
  })

  it('refuses retries after the configured attempts are exhausted', () => {
    const running = startJobAttempt(createJobRecord({ id: 'job-1', kind: 'media.transcode', title: 'Example' }))
    expect(() => scheduleJobRetry(running, 'failed')).toThrow(/attempts exhausted/)
  })
})
