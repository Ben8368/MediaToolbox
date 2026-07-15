import path from 'node:path'
import type { WorkOrderGetResponse } from '@mediatoolbox/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApiServer } from './app.js'

vi.mock('@mediatoolbox/psd-worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mediatoolbox/psd-worker')>()
  return {
    ...actual,
    runPsdWorkerJob: vi.fn().mockRejectedValue(new actual.PsdWorkerEngineNotConfiguredError()),
  }
})
import { PsdWorkerEngineNotConfiguredError, runPsdWorkerJob } from '@mediatoolbox/psd-worker'

describe('PSD job contract', () => {
  it('returns a PSD job immediately and persists a readable adapter error asynchronously', async () => {
    const app = await buildApiServer()

    const response = await app.inject({
      method: 'POST',
      url: '/api/psd/scan',
      payload: { psdPath: '/Workspace/PSD/template.psd' },
    })

    expect(response.statusCode).toBe(200)
    const jobId = response.json<{ job: { id: string } }>().job.id
    await new Promise((resolve) => setTimeout(resolve, 0))
    const detail = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
    expect(detail.json()).toMatchObject({
      job: { status: 'failed', errorMessage: 'Photoshop 命令未配置。' },
    })
    await app.close()
  })
})

describe('PSD workorder CRUD', () => {
  beforeEach(() => {
    vi.mocked(runPsdWorkerJob).mockReset()
    vi.mocked(runPsdWorkerJob).mockRejectedValue(new PsdWorkerEngineNotConfiguredError())
  })

  it('scan → read → update → list → apply 全链路', async () => {
    // 异步 scan 执行
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'scan',
      documentWidth: 1080,
      documentHeight: 1920,
      documentResolution: 72,
      records: [{
        id: 'layer-1', layerId: 1, layerPath: 'Group/Title', soChain: [], enabled: true,
        originalText: 'Hello', originalFontFamily: 'Arial', originalFontStyle: 'Regular',
        originalFontPs: 'ArialMT', originalSizePt: 24, originalLeadingPt: null,
        originalTrackingValue: 0, boundsHPx: 40, boundsWPx: 200, fakesBold: false,
      }],
    })
    // 异步 apply 执行
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'apply',
      outputPath: '/Workspace/Exports/smoke_adapted.psd',
      appliedCount: 1, skippedCount: 0, results: [],
    })

    const app = await buildApiServer()

    const scanResp = await app.inject({
      method: 'POST',
      url: '/api/psd/scan',
      payload: { psdPath: '/Workspace/PSD/smoke.psd' },
    })
    expect(scanResp.statusCode).toBe(200)
    const { workOrderId } = scanResp.json<{ workOrderId: string }>()
    expect(workOrderId).toBeTruthy()

    // 等待异步 scan 执行完成（mock 同步解析，微任务即可完成）
    await new Promise((resolve) => setTimeout(resolve, 0))

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
    expect(applyResp.json()).toMatchObject({ ok: true })

    await app.close()
  })

  it('scans an external file via inputGrantId and applies the resulting workorder (regression for grant-marker mishandling)', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const headers = {
      'x-mediatoolbox-desktop': 'desktop',
      'x-mediatoolbox-desktop-token': 'test-desktop-token',
    }

    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'scan',
      documentWidth: 800,
      documentHeight: 600,
      documentResolution: 72,
      records: [],
    })
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'apply',
      outputPath: '/Workspace/Exports/external_adapted.psd',
      appliedCount: 0,
      skippedCount: 0,
      results: [],
    })

    const app = await buildApiServer()

    const grantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers,
      payload: {
        kind: 'file.read',
        physicalPath: path.resolve('README.md'),
        displayName: 'external-template.psd',
      },
    })
    const grantId = grantResponse.json<{ grant: { id: string } }>().grant.id

    const scanResp = await app.inject({
      method: 'POST',
      url: '/api/psd/scan',
      payload: { inputGrantId: grantId },
    })
    expect(scanResp.statusCode).toBe(200)
    const { workOrderId } = scanResp.json<{ workOrderId: string }>()

    // scan 阶段传给 worker 的必须是 grant 解析出的真实物理路径，不是占位字符串。
    expect(vi.mocked(runPsdWorkerJob).mock.calls[0]![0]).toMatchObject({
      type: 'scan',
      psdPath: path.resolve('README.md'),
    })

    // 等待异步 scan 执行完成（mock 同步解析，微任务即可完成），否则 apply 会因工单未创建而 404。
    await new Promise((resolve) => setTimeout(resolve, 0))

    // scan 之后 grant 已绑定到工单 ID，作为其生命周期宿主，此时仍处于 active。
    const boundGrant = await app.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })
    expect(boundGrant.json<{ grant: { jobId?: string; status: string } }>().grant).toMatchObject({
      jobId: workOrderId,
      status: 'active',
    })

    const reusedGrant = await app.inject({
      method: 'POST',
      url: '/api/psd/scan',
      payload: { inputGrantId: grantId },
    })
    expect(reusedGrant.statusCode).toBe(400)
    expect(reusedGrant.json()).toMatchObject({ ok: false, message: expect.stringContaining('已被其他任务使用') })

    const applyResp = await app.inject({
      method: 'POST',
      url: `/api/psd/workorders/${workOrderId}/apply`,
      payload: {},
    })
    expect(applyResp.statusCode).toBe(200)
    expect(applyResp.json()).toMatchObject({ ok: true })

    // apply 阶段重新解析 workOrder.psdPath 中保存的 grant 标记，同样必须落回同一个真实物理路径。
    // calls[0]=scan, calls[1]=apply。
    expect(vi.mocked(runPsdWorkerJob).mock.calls[1]![0]).toMatchObject({
      type: 'apply',
      workOrder: expect.objectContaining({ psdPath: path.resolve('README.md') }),
    })

    // 工单应用完成后，绑定的读授权必须被自动吊销，不能无限期存活。
    const afterApply = await app.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })
    expect(afterApply.statusCode).toBe(404)

    await app.close()
  })

  it('does not consume an output grant when the workorder input grant is invalid', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const headers = {
      'x-mediatoolbox-desktop': 'desktop',
      'x-mediatoolbox-desktop-token': 'test-desktop-token',
    }
    vi.mocked(runPsdWorkerJob).mockResolvedValueOnce({
      type: 'scan',
      documentWidth: 800,
      documentHeight: 600,
      documentResolution: 72,
      records: [],
    })
    const app = await buildApiServer()
    const inputGrantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers,
      payload: { kind: 'file.read', physicalPath: path.resolve('README.md'), displayName: 'input.psd' },
    })
    const inputGrantId = inputGrantResponse.json<{ grant: { id: string } }>().grant.id
    const scanResponse = await app.inject({ method: 'POST', url: '/api/psd/scan', payload: { inputGrantId } })
    const workOrderId = scanResponse.json<{ workOrderId: string }>().workOrderId
    await new Promise((resolve) => setTimeout(resolve, 0))
    await app.inject({ method: 'DELETE', url: `/api/path-grants/${inputGrantId}` })

    const outputGrantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers,
      payload: { kind: 'file.write', physicalPath: path.resolve('output.psd'), displayName: 'output.psd' },
    })
    const outputGrantId = outputGrantResponse.json<{ grant: { id: string } }>().grant.id
    const applyResponse = await app.inject({
      method: 'POST',
      url: `/api/psd/workorders/${workOrderId}/apply`,
      payload: { outputGrantId },
    })
    const outputGrantAfterFailure = await app.inject({ method: 'GET', url: `/api/path-grants/${outputGrantId}` })

    expect(applyResponse.statusCode).toBe(400)
    expect(outputGrantAfterFailure.statusCode).toBe(200)
    expect(outputGrantAfterFailure.json()).toMatchObject({ grant: { status: 'active' } })
    await app.close()
  })

  it('cancels an in-flight PSD scan without creating a workorder and revokes its input grant', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const headers = {
      'x-mediatoolbox-desktop': 'desktop',
      'x-mediatoolbox-desktop-token': 'test-desktop-token',
    }
    vi.mocked(runPsdWorkerJob).mockImplementationOnce((_job, _runner, options) => new Promise((_resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const app = await buildApiServer()
    const grantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers,
      payload: { kind: 'file.read', physicalPath: path.resolve('README.md'), displayName: 'cancel.psd' },
    })
    const grantId = grantResponse.json<{ grant: { id: string } }>().grant.id
    const scanResponse = await app.inject({ method: 'POST', url: '/api/psd/scan', payload: { inputGrantId: grantId } })
    const { job, workOrderId } = scanResponse.json<{ job: { id: string }; workOrderId: string }>()
    expect(workOrderId).toBe(job.id)

    await app.inject({ method: 'POST', url: `/api/jobs/${job.id}/cancel` })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const detail = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}` })
    const workOrderResponse = await app.inject({ method: 'GET', url: `/api/psd/workorders/${workOrderId}` })
    const grantAfterCancel = await app.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })

    expect(detail.json()).toMatchObject({ job: { status: 'canceled' } })
    expect(workOrderResponse.statusCode).toBe(404)
    expect(grantAfterCancel.statusCode).toBe(404)
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
  beforeEach(() => {
    vi.mocked(runPsdWorkerJob).mockReset()
    vi.mocked(runPsdWorkerJob).mockRejectedValue(new PsdWorkerEngineNotConfiguredError())
  })

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
