import { describe, expect, it } from 'vitest'

import { buildApiServer } from '../app.js'

describe('browser network API contract', () => {
  it('records browser network downloads as jobs and workspace assets', async () => {
    const app = buildApiServer()
    const headers = { 'x-mediatoolbox-browser-network': 'desktop' }

    const created = await app.inject({
      method: 'POST',
      url: '/api/browser-network/downloads',
      headers,
      payload: {
        id: 'desktop-generated-download-1',
        source_url: 'https://example.com/file.zip',
        url_chain: ['https://example.com/file.zip'],
        filename: 'file.zip',
        target_path: '/Workspace/Downloads/file.zip',
        view_id: 'browser',
        session_id: 'mediatoolbox-browser-browser',
        total_bytes: 100,
        mime_type: 'application/zip',
        user_gesture: true,
      },
    })
    const download = created.json<{ download: { id: string; job_id: string } }>().download

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/browser-network/downloads/${download.id}`,
      headers,
      payload: { status: 'succeeded', received_bytes: 100, total_bytes: 100 },
    })
    const job = await app.inject({ method: 'GET', url: `/api/jobs/${download.job_id}` })
    const assets = await app.inject({ method: 'GET', url: '/api/assets' })

    expect(created.statusCode).toBe(200)
    expect(download.id).toBe('desktop-generated-download-1')
    expect(download.job_id).toBe('desktop-generated-download-1')
    expect(updated.json()).toMatchObject({ ok: true, download: expect.objectContaining({ status: 'succeeded' }) })
    expect(job.json()).toMatchObject({
      ok: true,
      job: expect.objectContaining({
        kind: 'browser.download',
        status: 'succeeded',
        progress: { current: 100, total: 100, unit: 'bytes' },
      }),
    })
    expect(assets.json()).toMatchObject({
      ok: true,
      assets: [expect.objectContaining({ id: 'asset-desktop-generated-download-1', path: '/Workspace/Downloads/file.zip' })],
    })
    await app.close()
  })

  it('analyzes download routing with yt-dlp preferred and browser fallback', async () => {
    const app = buildApiServer()

    const media = await app.inject({
      method: 'POST',
      url: '/api/downloads/analyze',
      payload: { url: 'https://www.youtube.com/watch?v=demo' },
    })
    const image = await app.inject({
      method: 'POST',
      url: '/api/downloads/analyze',
      payload: { url: 'https://example.com/image.png' },
    })

    expect(media.json()).toMatchObject({
      ok: true,
      analysis: expect.objectContaining({
        route: 'ytdlp',
        primary: 'yt-dlp',
        fallback: 'browser-network',
        ytdlp_scope: expect.objectContaining({
          supports_generic_extractor: true,
          reliable_check: 'try-extractor',
        }),
      }),
    })
    expect(image.json()).toMatchObject({
      ok: true,
      analysis: expect.objectContaining({
        route: 'browser',
        primary: 'browser-network',
      }),
    })
    await app.close()
  })

  it('records browser network requests as unified jobs', async () => {
    const app = buildApiServer()
    const headers = { 'x-mediatoolbox-browser-network': 'desktop' }

    const created = await app.inject({
      method: 'POST',
      url: '/api/browser-network/requests',
      headers,
      payload: {
        id: 'desktop-generated-request-1',
        url: 'https://example.com/api',
        method: 'POST',
        view_id: 'browser',
        session_id: 'mediatoolbox-browser-default',
        request_headers: { accept: 'application/json' },
      },
    })
    const requestRecord = created.json<{ request: { id: string; job_id: string } }>().request

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/browser-network/requests/${requestRecord.id}`,
      headers,
      payload: {
        status: 'succeeded',
        response_status: 204,
        response_headers: { 'content-type': 'application/json' },
        response_bytes: 12,
      },
    })
    const job = await app.inject({ method: 'GET', url: `/api/jobs/${requestRecord.job_id}` })

    expect(created.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({ ok: true, request: expect.objectContaining({ status: 'succeeded', response_status: 204 }) })
    expect(job.json()).toMatchObject({
      ok: true,
      job: expect.objectContaining({
        kind: 'browser.request',
        status: 'succeeded',
        progress: { current: 12, total: 12, unit: 'bytes' },
      }),
    })
    await app.close()
  })

  it('protects browser network write endpoints and target paths', async () => {
    const app = buildApiServer()
    const payload = {
      source_url: 'https://example.com/file.zip',
      filename: 'file.zip',
      target_path: '/Workspace/Exports/file.zip',
      view_id: 'browser',
      session_id: 'mediatoolbox-browser-browser',
    }

    const missingMarker = await app.inject({
      method: 'POST',
      url: '/api/browser-network/downloads',
      payload: { ...payload, target_path: '/Workspace/Downloads/file.zip' },
    })
    const wrongTarget = await app.inject({
      method: 'POST',
      url: '/api/browser-network/downloads',
      headers: { 'x-mediatoolbox-browser-network': 'desktop' },
      payload,
    })

    expect(missingMarker.statusCode).toBe(403)
    expect(wrongTarget.statusCode).toBe(400)
    expect(wrongTarget.json()).toMatchObject({ ok: false, message: '浏览器下载只能写入工作区 Downloads 目录。' })
    await app.close()
  })

  it('rejects duplicate browser network ids before job creation', async () => {
    const app = buildApiServer()
    const headers = { 'x-mediatoolbox-browser-network': 'desktop' }
    const payload = {
      id: 'desktop-generated-download-duplicate',
      source_url: 'https://example.com/file.zip',
      filename: 'file.zip',
      target_path: '/Workspace/Downloads/file.zip',
      view_id: 'browser',
      session_id: 'mediatoolbox-browser-browser',
    }

    const created = await app.inject({ method: 'POST', url: '/api/browser-network/downloads', headers, payload })
    const duplicate = await app.inject({ method: 'POST', url: '/api/browser-network/downloads', headers, payload })

    expect(created.statusCode).toBe(200)
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json()).toMatchObject({ ok: false, message: '浏览器下载记录已存在。' })
    await app.close()
  })
})
