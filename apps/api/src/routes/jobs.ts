import type { FastifyInstance } from 'fastify'
import { canTransitionJob, createJobRecord, transitionJob } from '@mediatoolbox/job-core'
import type { JobRecord, OkResult } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'
import { abortDownload } from '../download-executor.js'
import { abortTranscode } from '../transcode-executor.js'
import { abortWebComposerRender } from '../web-composer-executor.js'
import { addLog, isTerminalTask, nowSeconds } from '../utils.js'

export function registerJobRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { kind?: string; title?: string }; Reply: JobRecord }>('/api/jobs', async (request) => {
    const allowedKind = request.body.kind === 'media.transcode'
      || request.body.kind === 'psd.apply'
      || request.body.kind === 'browser.download'
      || request.body.kind === 'web.render.image'
      || request.body.kind === 'web.render.video'
    const job = createJobRecord({
      id: `job-${Date.now()}`,
      kind: allowedKind ? request.body.kind as JobRecord['kind'] : 'download.video',
      title: request.body.title || '本地任务',
    })
    await state.db.jobs.create(job)
    return job
  })

  app.get<{ Reply: { ok: boolean; jobs: JobRecord[] } }>('/api/jobs', async () => {
    const jobs = await state.db.jobs.list()
    return { ok: true, jobs }
  })

  app.get<{ Params: { id: string }; Reply: { ok: boolean; job?: JobRecord } }>('/api/jobs/:id', async (request) => {
    const job = await state.db.jobs.findById(request.params.id)
    return job ? { ok: true, job } : { ok: true }
  })

  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/jobs/:id/cancel', async (request, reply) => {
    const job = await state.db.jobs.findById(request.params.id)
    if (!job) {
      reply.status(404)
      return { ok: false, message: '任务不存在。' }
    }

    if (!canTransitionJob(job.status, 'canceled')) {
      return { ok: true, message: '任务已处于终态，无需取消。' }
    }

    if (job.kind.startsWith('download.')) {
      abortDownload(job.id)
      const task = state.fetchTasks.find((item) => item.id === job.id || item.task_id === job.id)
      if (task && !isTerminalTask(task)) {
        task.status = 'cancelled'
        task.stage = '已取消'
        task.updated_at = nowSeconds()
        task.completed_at = task.updated_at
      }
    } else if (job.kind === 'browser.download') {
      const download = state.browserDownloads.find((item) => item.job_id === job.id)
      if (download && download.status !== 'succeeded' && download.status !== 'failed' && download.status !== 'canceled') {
        download.status = 'canceled'
        download.updated_at = nowSeconds()
        download.completed_at = download.updated_at
        download.error = '统一任务中心请求取消浏览器下载。'
      }
    } else if (job.kind === 'media.transcode') {
      abortTranscode(job.id)
    } else if (job.kind === 'web.render.image' || job.kind === 'web.render.video') {
      abortWebComposerRender(job.id)
    }

    await state.db.jobs.update(transitionJob(job, 'canceled'))
    addLog(state.db, 'WARNING', 'jobs', `取消任务：${job.title}`)
    return { ok: true }
  })
}
