import { createJobRecord } from '@mediatoolbox/job-core'
import { describe, expect, it } from 'vitest'

import { createApiState } from './state.js'
import { deferJobRetry, startJobExecution, updateJobRecord } from './job-utils.js'

describe('job retry resource lifecycle', () => {
  it('retains a bound read grant between attempts and revokes it on the final terminal state', async () => {
    const state = createApiState()
    const now = Math.floor(Date.now() / 1000)
    const job = createJobRecord({
      id: 'retry-grant-job',
      kind: 'media.transcode',
      title: 'retry grant',
      maxAttempts: 3,
    })
    await state.db.jobs.create(job)
    await state.db.pathGrants.create({
      id: 'retry-grant',
      kind: 'file.read',
      status: 'active',
      physicalPath: 'C:\\outside\\input.mp4',
      displayName: 'input.mp4',
      expiresAt: now + 300,
      createdAt: now,
      updatedAt: now,
      jobId: job.id,
    })

    await expect(startJobExecution(state, job.id)).resolves.toMatchObject({ attempt: 1, status: 'running' })
    await expect(deferJobRetry(state, job.id, 'temporary failure')).resolves.toMatchObject({ status: 'queued' })
    await expect(state.db.pathGrants.findById('retry-grant')).resolves.toMatchObject({ status: 'active' })

    await expect(updateJobRecord(state, job.id, 'canceled')).resolves.toBe(true)
    await expect(state.db.jobs.findById(job.id)).resolves.not.toHaveProperty('nextAttemptAt')
    await expect(state.db.pathGrants.findById('retry-grant')).resolves.toMatchObject({ status: 'revoked' })
    state.db.close()
  })
})
