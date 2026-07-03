import { describe, expect, it } from 'vitest'
import { canTransitionJob, createJobRecord, transitionJob } from './index.js'

describe('job state machine', () => {
  it('creates queued jobs', () => {
    const job = createJobRecord({ id: 'job-1', kind: 'download.video', title: 'Example' })
    expect(job.status).toBe('queued')
  })

  it('allows queued jobs to start', () => {
    expect(canTransitionJob('queued', 'running')).toBe(true)
  })

  it('rejects impossible transitions', () => {
    const job = createJobRecord({ id: 'job-1', kind: 'download.video', title: 'Example' })
    expect(() => transitionJob(job, 'succeeded')).toThrow(/Invalid job transition/)
  })
})
