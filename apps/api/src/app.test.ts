import { describe, expect, it } from 'vitest'
import { buildApiServer } from './app.js'

describe('api skeleton contract', () => {
  it('serves health and app metadata', async () => {
    const app = buildApiServer()

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    const apps = await app.inject({ method: 'GET', url: '/api/apps' })

    expect(health.json()).toMatchObject({ ok: true, service: 'mediatoolbox-api' })
    expect(apps.json()).toMatchObject({ apps: expect.arrayContaining([expect.objectContaining({ id: 'download' })]) })
    await app.close()
  })

  it('creates, lists, and cancels fetch task skeletons', async () => {
    const app = buildApiServer()

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

  it('serves file browser and metrics skeletons', async () => {
    const app = buildApiServer()

    const directory = await app.inject({ method: 'POST', url: '/api/filebrowser/list', payload: { directory: '/Workspace' } })
    const metrics = await app.inject({ method: 'GET', url: '/api/system/metrics' })

    expect(directory.json()).toMatchObject({ ok: true, path: '/Workspace' })
    expect(metrics.json()).toMatchObject({
      runtime: expect.any(Object),
      system: expect.objectContaining({ gpu_available: false }),
      network: expect.objectContaining({ upload_bytes_per_sec: 0 }),
    })
    await app.close()
  })

  it('rejects invalid fetch submissions with a readable error payload', async () => {
    const app = buildApiServer()

    const response = await app.inject({
      method: 'POST',
      url: '/api/fetch/tasks',
      payload: { output_dir: 'downloads' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ ok: false, message: '请求参数不符合 API 契约。' })
    await app.close()
  })

  it('rejects workspace path escapes before real filesystem access is added', async () => {
    const app = buildApiServer()

    const traversal = await app.inject({
      method: 'POST',
      url: '/api/filebrowser/list',
      payload: { directory: '../outside' },
    })
    const drivePath = await app.inject({
      method: 'POST',
      url: '/api/filebrowser/mkdir',
      payload: { path: 'C:/Users/demo' },
    })

    expect(traversal.statusCode).toBe(400)
    expect(traversal.json()).toMatchObject({ ok: false, message: '路径不能包含 . 或 .. 段。' })
    expect(drivePath.statusCode).toBe(400)
    expect(drivePath.json()).toMatchObject({ ok: false, message: '路径必须位于工作区内，不能使用磁盘盘符。' })
    await app.close()
  })

  it('fetch task creation and cancellation are reflected in the job list', async () => {
    const app = buildApiServer()

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
    const app = buildApiServer()

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
})
