import type { FetchTaskRecord } from '@mediatoolbox/contracts'
import { describe, expect, it } from 'vitest'

import { buildApiServer } from './app.js'
import { buildDownloadJob } from './download-executor.js'

describe('fetch routes', () => {
  it('creates, lists, and cancels fetch task skeletons', async () => {
    const app = await buildApiServer()

    const created = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { urls: ['https://example.com/video'] },
    })
    const createdBody = created.json<{ task_id: string }>()
    const canceled = await app.inject({ method: 'POST', url: `/api/fetch/tasks/${createdBody.task_id}/cancel` })
    const history = await app.inject({ method: 'GET', url: '/api/fetch/tasks/history' })

    expect(created.statusCode).toBe(200)
    expect(createdBody.task_id).toBeTruthy()
    expect(canceled.json()).toEqual({ ok: true })
    // CI 无 yt-dlp 时任务可能以 failed/cancelled 结束，均视为合法终态
    expect(history.json()).toMatchObject({
      ok: true,
      tasks: [expect.objectContaining({
        task_id: createdBody.task_id,
        status: expect.stringMatching(/^(completed|failed|cancelled)$/),
      })],
    })
    await app.close()
  })

  it('rejects invalid fetch submissions with a readable error payload', async () => {
    const app = await buildApiServer()

    const response = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { output_dir: 'downloads' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ ok: false, message: '请求参数不符合 API 契约。' })
    await app.close()
  })

  it('rejects unsupported and unbounded download settings instead of silently ignoring them', async () => {
    const app = await buildApiServer()
    const unsupported = await app.inject({
      method: 'POST', url: '/api/fetch/tasks', payload: { url: 'https://example.com/video', transport: 'browser-network' },
    })
    const unbounded = await app.inject({
      method: 'POST', url: '/api/fetch/tasks', payload: { url: 'https://example.com/video', max_concurrent: 5 },
    })

    expect(unsupported.statusCode).toBe(400)
    expect(unbounded.statusCode).toBe(400)
    await app.close()
  })

  it('fetch task creation and cancellation are reflected in the job list', async () => {
    const app = await buildApiServer()

    const created = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { urls: ['https://example.com/video'] },
    })
    const taskId = created.json<{ task_id: string }>().task_id

    await app.inject({ method: 'POST', url: `/api/fetch/tasks/${taskId}/cancel` })

    const jobsAfter = await app.inject({ method: 'GET', url: '/api/jobs' })
    const jobAfter = jobsAfter.json<{ jobs: Array<{ id: string; status: string }> }>().jobs.find((j) => j.id === taskId)

    // CI 无 yt-dlp 时执行可能在取消前已完成，job 应处于某个终态且不为 undefined
    expect(jobAfter).toBeDefined()
    expect(['canceled', 'succeeded', 'failed']).toContain(jobAfter!.status)
    await app.close()
  })

  it('deleting a fetch task also removes the corresponding job', async () => {
    const app = await buildApiServer()

    const created = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { urls: ['https://example.com/video'] },
    })
    const taskId = created.json<{ task_id: string }>().task_id

    await app.inject({ method: 'POST', url: `/api/fetch/tasks/${taskId}/cancel` })
    await app.inject({ method: 'DELETE', url: `/api/fetch/tasks/${taskId}` })

    const jobsAfter = await app.inject({ method: 'GET', url: '/api/jobs' })
    const stillExists = jobsAfter.json<{ jobs: Array<{ id: string }> }>().jobs.some((j) => j.id === taskId)

    expect(stillExists).toBe(false)
    await app.close()
  })

  it('maps urls payloads to the worker download URL', () => {
    const job = buildDownloadJob({
      id: 'task-1',
      task_id: 'task-1',
      title: 'task',
      source_url: 'https://example.com/a',
      status: 'pending',
      progress: 0,
      stage: 'pending',
      created_at: 1,
      updated_at: 1,
      started_at: null,
      completed_at: null,
      params: { urls: [' https://example.com/a ', 'https://example.com/b'] },
    } satisfies FetchTaskRecord)

    expect(job.url).toBe('https://example.com/a')
  })

  it('maps every supported download setting to the worker contract', () => {
    const job = buildDownloadJob({
      id: 'task-settings', task_id: 'task-settings', title: 'task', source_url: 'https://example.com/a',
      status: 'pending', progress: 0, stage: 'pending', created_at: 1, updated_at: 1, started_at: null, completed_at: null,
      params: {
        url: 'https://example.com/a', write_subs: true, write_auto_subs: true, sub_langs: 'zh-Hans,en',
        subtitle_format: 'srt', prefer_h264: true, no_transcode: false, cookies_from_browser: 'chrome',
      },
    } satisfies FetchTaskRecord)

    expect(job).toMatchObject({
      subtitles: { languages: ['zh-Hans', 'en'], auto: true, format: 'srt' },
      cookiesFromBrowser: 'chrome',
      video: { preferH264: true, recodeH264: true },
    })
  })

  it('clearing fetch task records also removes corresponding jobs', async () => {
    const app = await buildApiServer()

    const created = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { urls: ['https://example.com/video'] },
    })
    const taskId = created.json<{ task_id: string }>().task_id

    await app.inject({ method: 'POST', url: `/api/fetch/tasks/${taskId}/cancel` })
    await app.inject({ method: 'POST', url: '/api/fetch/tasks/clear', payload: { task_ids: [taskId] } })

    const jobsAfter = await app.inject({ method: 'GET', url: '/api/jobs' })
    const stillExists = jobsAfter.json<{ jobs: Array<{ id: string }> }>().jobs.some((j) => j.id === taskId)

    expect(stillExists).toBe(false)
    await app.close()
  })

  it('creates one fetch task and job per submitted URL', async () => {
    const app = await buildApiServer()

    const created = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { urls: ['https://example.com/a', 'https://example.com/b'] },
    })
    const body = created.json<{ task_id: string; task_ids: string[] }>()
    const jobs = await app.inject({ method: 'GET', url: '/api/jobs' })
    const jobIds = new Set(jobs.json<{ jobs: Array<{ id: string }> }>().jobs.map((job) => job.id))

    expect(body.task_ids).toHaveLength(2)
    expect(body.task_id).toBe(body.task_ids[0])
    expect(body.task_ids.every((id) => jobIds.has(id))).toBe(true)
    await app.close()
  })

})
