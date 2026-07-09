import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import type { FetchTaskRecord, WorkOrderGetResponse } from '@mediatoolbox/contracts'

import { buildApiServer } from './app.js'

vi.mock('@mediatoolbox/psd-worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mediatoolbox/psd-worker')>()
  return {
    ...actual,
    runPsdWorkerJob: vi.fn().mockRejectedValue(new actual.PsdWorkerEngineNotConfiguredError()),
  }
})
import { runPsdWorkerJob } from '@mediatoolbox/psd-worker'
import { buildDownloadJob } from './download-executor.js'

describe('api skeleton contract', () => {
  it('serves health and app metadata', async () => {
    const app = await buildApiServer()

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    const apps = await app.inject({ method: 'GET', url: '/api/apps' })

    expect(health.json()).toMatchObject({ ok: true, service: 'mediatoolbox-api' })
    expect(apps.json()).toMatchObject({
      apps: expect.arrayContaining([
        expect.objectContaining({ id: 'browser' }),
        expect.objectContaining({ id: 'fetcher' }),
      ]),
    })
    await app.close()
  })

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

  it('serves file browser and metrics skeletons', async () => {
    const app = await buildApiServer()

    const directory = await app.inject({ method: 'POST', url: '/api/filebrowser/list', payload: { directory: '/Workspace' } })
    const disks = await app.inject({ method: 'GET', url: '/api/filebrowser/disks' })
    const metrics = await app.inject({ method: 'GET', url: '/api/system/metrics' })

    expect(directory.json()).toMatchObject({ ok: true, path: '/Workspace' })
    const disksBody = disks.json<{ ok: boolean; disks: unknown[] }>()
    expect(disksBody.ok).toBe(true)
    // Disk detection requires native OS integration; only assert on Windows CI
    if (process.platform === 'win32') {
      expect(disksBody.disks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: '/Workspace',
            name: expect.stringMatching(/^本地磁盘 \(.+\)$/),
            browsable: true,
            total: expect.any(Number),
            used: expect.any(Number),
            free: expect.any(Number),
          }),
        ]),
      )
    }
    const metricsBody = metrics.json()
    expect(metricsBody).toMatchObject({
      runtime: expect.any(Object),
      system: expect.objectContaining({
        cpu_percent: expect.any(Number),
        gpu_available: expect.any(Boolean),
        gpu_percent: expect.any(Number),
        memory_percent: expect.any(Number),
        memory_used_bytes: expect.any(Number),
        memory_total_bytes: expect.any(Number),
        memory_free_bytes: expect.any(Number),
      }),
      network: expect.objectContaining({ upload_bytes_per_sec: 0 }),
    })
    if (process.platform === 'darwin') {
      expect(metricsBody.system).toMatchObject({
        memory_pressure_percent: expect.any(Number),
        memory_pressure_label: expect.any(String),
      })
    }
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

  it('rejects workspace path escapes before real filesystem access is added', async () => {
    const app = await buildApiServer()

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

  it('rejects unsafe transcode paths before invoking ffmpeg', async () => {
    const app = await buildApiServer()

    const drivePath = await app.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      payload: { inputPath: 'C:/Users/demo/input.mov', outputPath: '/Workspace/Exports/out.mp4' },
    })
    const outsideExports = await app.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      payload: { inputPath: '/Workspace/README.txt', outputPath: '/Workspace/out.mp4' },
    })

    expect(drivePath.statusCode).toBe(400)
    expect(outsideExports.statusCode).toBe(400)
    await app.close()
  })

  it('accepts transcode jobs that use a read path grant instead of an input path', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const app = await buildApiServer()
    const headers = {
      'x-mediatoolbox-desktop': 'desktop',
      'x-mediatoolbox-desktop-token': 'test-desktop-token',
    }

    const grantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers,
      payload: {
        kind: 'file.read',
        physicalPath: path.resolve('README.md'),
        displayName: 'README.md',
      },
    })
    const grantId = grantResponse.json<{ grant: { id: string } }>().grant.id

    const created = await app.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      payload: {
        inputGrantId: grantId,
        outputPath: '/Workspace/Exports/out.mp4',
        preset: 'copy',
      },
    })

    expect(created.statusCode).toBe(200)
    expect(created.json()).toMatchObject({ kind: 'media.transcode' })
    await app.close()
  })

  it('updates workspace state instead of returning a fake success', async () => {
    const app = await buildApiServer()

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/filebrowser/workspace',
      payload: { workspace: '/Workspace/ProjectA' },
    })
    const workspace = await app.inject({ method: 'GET', url: '/api/filebrowser/workspace' })
    const directory = await app.inject({
      method: 'POST',
      url: '/api/filebrowser/list',
      payload: { directory: '/Workspace/ProjectA' },
    })

    expect(updated.json()).toMatchObject({ ok: true, workspace: '/Workspace/ProjectA' })
    expect(workspace.json()).toMatchObject({ ok: true, project_root: '/Workspace/ProjectA' })
    expect(directory.json()).toMatchObject({ ok: true, path: '/Workspace/ProjectA' })
    await app.close()
  })

  it('restores file browser trash entries and rejects non-empty directory deletes', async () => {
    const app = await buildApiServer()

    await app.inject({ method: 'DELETE', url: '/api/filebrowser/path', payload: { path: '/Workspace/README.txt', to_trash: true } })
    const trash = await app.inject({ method: 'GET', url: '/api/filebrowser/trash' })
    const trashId = trash.json<{ items: Array<{ id: string }> }>().items[0]!.id
    await app.inject({ method: 'POST', url: `/api/filebrowser/trash/${trashId}/restore` })
    const root = await app.inject({ method: 'POST', url: '/api/filebrowser/list', payload: { directory: '/Workspace' } })

    await app.inject({ method: 'POST', url: '/api/filebrowser/mkdir', payload: { path: '/Workspace/Downloads/Nested' } })
    const nonEmptyDelete = await app.inject({ method: 'DELETE', url: '/api/filebrowser/path', payload: { path: '/Workspace/Downloads', to_trash: true } })

    expect(root.json<{ files: Array<{ name: string }> }>().files.some((file) => file.name === 'README.txt')).toBe(true)
    expect(nonEmptyDelete.json()).toMatchObject({ ok: false })
    await app.close()
  })

  it('cancels queued jobs through the unified jobs endpoint', async () => {
    const app = await buildApiServer()

    const created = await app.inject({ method: 'POST', url: '/api/jobs', payload: { title: 'Manual job' } })
    const jobId = created.json<{ id: string }>().id
    const canceled = await app.inject({ method: 'POST', url: `/api/jobs/${jobId}/cancel` })
    const detail = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })

    expect(canceled.json()).toMatchObject({ ok: true })
    expect(detail.json<{ job: { status: string } }>().job.status).toBe('canceled')
    await app.close()
  })

  it('clears logs and marks derived notifications as read', async () => {
    const app = await buildApiServer()

    const created = await app.inject({ method: 'POST', url: '/api/jobs', payload: { title: 'Notification job' } })
    const jobId = created.json<{ id: string }>().id
    await app.inject({ method: 'POST', url: `/api/jobs/${jobId}/cancel` })

    const unreadBefore = await app.inject({ method: 'GET', url: '/api/notifications/unread-count' })
    await app.inject({ method: 'POST', url: '/api/notifications/read-all' })
    const unreadAfter = await app.inject({ method: 'GET', url: '/api/notifications/unread-count' })
    await app.inject({ method: 'DELETE', url: '/api/logs' })
    const logs = await app.inject({ method: 'GET', url: '/api/logs' })

    expect(unreadBefore.json<{ unread_count: number }>().unread_count).toBeGreaterThan(0)
    expect(unreadAfter.json()).toMatchObject({ ok: true, unread_count: 0 })
    expect(logs.json()).toMatchObject({ ok: true, total: 0, items: [] })
    await app.close()
  })

  it('requires an explicit local shutdown marker', async () => {
    const app = await buildApiServer()

    const response = await app.inject({ method: 'POST', url: '/api/system/shutdown' })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ ok: false })
    await app.close()
  })

  it('returns a readable PSD adapter error when Photoshop is not configured', async () => {
    const app = await buildApiServer()

    const response = await app.inject({
      method: 'POST',
      url: '/api/psd/scan',
      payload: { psdPath: '/Workspace/PSD/template.psd' },
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ ok: false, message: 'Photoshop 命令未配置，暂不能扫描 PSD。' })
    await app.close()
  })
})

describe('PSD workorder CRUD', () => {
  it('scan → read → update → list → apply 全链路', async () => {
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'scan',
      documentWidth: 1080,
      documentHeight: 1920,
      documentResolution: 72,
      records: [{
        id: 'layer-1',
        layerId: 1,
        layerPath: 'Group/Title',
        soChain: [],
        enabled: true,
        originalText: 'Hello',
        originalFontFamily: 'Arial',
        originalFontStyle: 'Regular',
        originalFontPs: 'ArialMT',
        originalSizePt: 24,
        originalLeadingPt: null,
        originalTrackingValue: 0,
        boundsHPx: 40,
        boundsWPx: 200,
        fakesBold: false,
      }],
    })
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'apply',
      outputPath: '/Workspace/Exports/smoke_adapted.psd',
      appliedCount: 1,
      skippedCount: 0,
    })

    const app = await buildApiServer()

    const scanResp = await app.inject({
      method: 'POST',
      url: '/api/psd/scan',
      payload: { psdPath: '/Workspace/PSD/smoke.psd' },
    })
    expect(scanResp.statusCode).toBe(200)
    const { workOrderId, recordCount } = scanResp.json<{ workOrderId: string; recordCount: number }>()
    expect(workOrderId).toBeTruthy()
    expect(recordCount).toBe(1)

    const getResp = await app.inject({ method: 'GET', url: `/api/psd/workorders/${workOrderId}` })
    expect(getResp.statusCode).toBe(200)
    const { workOrder } = getResp.json<WorkOrderGetResponse>()
    expect(workOrder!.records[0]!.originalText).toBe('Hello')

    const updated = { ...workOrder!, records: [{ ...workOrder!.records[0]!, newText: '你好' }] }
    const putResp = await app.inject({
      method: 'PUT',
      url: `/api/psd/workorders/${workOrderId}`,
      payload: { workOrder: updated },
    })
    expect(putResp.statusCode).toBe(200)
    expect(putResp.json()).toMatchObject({ ok: true })

    const getAfterPut = await app.inject({ method: 'GET', url: `/api/psd/workorders/${workOrderId}` })
    expect(getAfterPut.json<WorkOrderGetResponse>().workOrder!.records[0]!.newText).toBe('你好')

    const listResp = await app.inject({ method: 'GET', url: '/api/psd/workorders' })
    expect(listResp.statusCode).toBe(200)
    const { workOrders } = listResp.json<{ workOrders: Array<{ id: string }> }>()
    expect(workOrders.some((wo) => wo.id === workOrderId)).toBe(true)

    const applyResp = await app.inject({
      method: 'POST',
      url: `/api/psd/workorders/${workOrderId}/apply`,
      payload: {},
    })
    expect(applyResp.statusCode).toBe(200)
    expect(applyResp.json()).toMatchObject({ ok: true, appliedCount: 1, skippedCount: 0 })

    await app.close()
  })

  it('returns 404 for unknown workorder', async () => {
    const app = await buildApiServer()
    const resp = await app.inject({ method: 'GET', url: '/api/psd/workorders/nonexistent-id' })
    expect(resp.statusCode).toBe(404)
    expect(resp.json()).toMatchObject({ ok: false, message: '工单不存在' })
    await app.close()
  })
})

describe('PSD fonts endpoint', () => {
  it('returns 503 when Photoshop is not configured', async () => {
    const app = await buildApiServer()
    const resp = await app.inject({ method: 'GET', url: '/api/psd/fonts' })
    expect(resp.statusCode).toBe(503)
    expect(resp.json()).toMatchObject({ ok: false, message: 'Photoshop 命令未配置，暂不能获取字体列表。' })
    await app.close()
  })

  it('returns font list when Photoshop is configured', async () => {
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'list-fonts',
      fonts: [
        { postScriptName: 'ArialMT', family: 'Arial', style: 'Regular' },
        { postScriptName: 'Arial-BoldMT', family: 'Arial', style: 'Bold' },
      ],
    })
    const app = await buildApiServer()
    const resp = await app.inject({ method: 'GET', url: '/api/psd/fonts' })
    expect(resp.statusCode).toBe(200)
    expect(resp.json()).toMatchObject({
      ok: true,
      fonts: expect.arrayContaining([
        expect.objectContaining({ postScriptName: 'ArialMT', family: 'Arial' }),
      ]),
    })
    await app.close()
  })
})
