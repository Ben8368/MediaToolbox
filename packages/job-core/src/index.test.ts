import { describe, expect, it } from 'vitest'
import { canTransitionJob, createJobId, createJobRecord, transitionJob } from './index.js'

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

  it('creates collision-resistant IDs independently of wall-clock time', () => {
    const ids = Array.from({ length: 100 }, () => createJobId('transcode'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^transcode-[0-9a-f-]{36}$/.test(id))).toBe(true)
  })

  it('allows active jobs to fail when their execution process is lost', () => {
    expect(canTransitionJob('queued', 'failed')).toBe(true)
    expect(canTransitionJob('paused', 'failed')).toBe(true)
  })
})
