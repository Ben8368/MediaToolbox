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
    const active = await app.inject({ method: 'GET', url: '/api/fetch/tasks' })
    const canceled = await app.inject({ method: 'POST', url: `/api/fetch/tasks/${createdBody.task_id}/cancel` })
    const history = await app.inject({ method: 'GET', url: '/api/fetch/tasks/history' })

    expect(created.statusCode).toBe(200)
    expect(active.json()).toMatchObject({ ok: true, tasks: [expect.objectContaining({ task_id: createdBody.task_id })] })
    expect(canceled.json()).toEqual({ ok: true })
    expect(history.json()).toMatchObject({ ok: true, tasks: [expect.objectContaining({ status: 'cancelled' })] })
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
})
