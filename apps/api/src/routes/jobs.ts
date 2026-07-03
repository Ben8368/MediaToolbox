import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { JobRecord, OkResult } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'

export function registerJobRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { kind?: string; title?: string }; Reply: JobRecord }>('/api/jobs', async (request) => {
    const job = createJobRecord({ id: `job-${Date.now()}`, kind: 'download.video', title: request.body.title || '骨架任务' })
    state.jobs.unshift(job)
    return job
  })
  app.get<{ Reply: { ok: boolean; jobs: JobRecord[] } }>('/api/jobs', async () => ({ ok: true, jobs: state.jobs }))
  app.get<{ Params: { id: string }; Reply: { ok: boolean; job?: JobRecord } }>('/api/jobs/:id', async (request) => {
    const job = state.jobs.find((item) => item.id === request.params.id)
    return job ? { ok: true, job } : { ok: true }
  })
  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/jobs/:id/cancel', async () => ({ ok: true, message: '任务队列执行器待接入。' }))
}
