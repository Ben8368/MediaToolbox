import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

import { buildApiServer } from '../app.js'

const servers: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function waitForImageJob(server: FastifyInstance, jobId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await server.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
    const body = response.json() as { job?: { status: string } }
    if (body.job?.status === 'succeeded' || body.job?.status === 'failed') return body.job
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('image export job did not finish')
}

describe('web composer export routes', () => {
  it('persists a validated PNG capture as a unified job and asset', async () => {
    const server = await buildApiServer()
    servers.push(server)
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('web-composer-test'),
    ])
    const response = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/png?presetId=lumora&presetVersion=2&width=1920&height=1080',
      headers: { 'content-type': 'application/octet-stream' },
      payload: png,
    })

    expect(response.statusCode).toBe(200)
    const created = response.json() as { id: string; kind: string }
    expect(created.kind).toBe('web.render.image')
    expect(await waitForImageJob(server, created.id)).toMatchObject({ status: 'succeeded' })

    const assets = await server.inject({ method: 'GET', url: '/api/assets' })
    expect(assets.json()).toMatchObject({
      ok: true,
      assets: expect.arrayContaining([
        expect.objectContaining({ id: `asset-${created.id}`, kind: 'image', mimeType: 'image/png' }),
      ]),
    })
  })

  it('rejects bytes that only claim to be a PNG', async () => {
    const server = await buildApiServer()
    servers.push(server)
    const response = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/png?presetId=lumora&presetVersion=2&width=1920&height=1080',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('not-a-png'),
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ ok: false, message: 'PNG 捕获数据格式不正确。' })
  })

  it('rejects unsupported preset references or an oversized canvas before persistence', async () => {
    const server = await buildApiServer()
    servers.push(server)
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const unsupportedVersion = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/png?presetId=lumora&presetVersion=1&width=1920&height=1080',
      headers: { 'content-type': 'application/octet-stream' },
      payload: png,
    })
    const unknownPreset = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/png?presetId=unknown&presetVersion=2&width=1920&height=1080',
      headers: { 'content-type': 'application/octet-stream' },
      payload: png,
    })
    const oversizedCanvas = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/png?presetId=lumora&presetVersion=2&width=3840&height=3840',
      headers: { 'content-type': 'application/octet-stream' },
      payload: png,
    })

    expect(unsupportedVersion.statusCode).toBe(400)
    expect(unsupportedVersion.json()).toMatchObject({ ok: false, message: '未知或不受支持的网页合成预设版本。' })
    expect(unknownPreset.statusCode).toBe(400)
    expect(unknownPreset.json()).toMatchObject({ ok: false, message: '未知或不受支持的网页合成预设版本。' })
    expect(oversizedCanvas.statusCode).toBe(400)
    expect(oversizedCanvas.json()).toMatchObject({ ok: false, message: '输出画布不能超过 4K 像素总量。' })
  })

  it('rejects bytes that only claim to be a video capture', async () => {
    const server = await buildApiServer()
    servers.push(server)
    const response = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/video?presetId=viktor&presetVersion=2&width=1920&height=1080&fps=12&durationSeconds=4',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('not-a-webm'),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ ok: false, message: 'WebM 捕获数据格式不正确。' })
  })

  it('accepts only the MP4 and transparent MOV video formats', async () => {
    const server = await buildApiServer()
    servers.push(server)
    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
    const accepted = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/video?presetId=viktor&presetVersion=2&width=1920&height=1080&fps=12&durationSeconds=4&videoFormat=mov-alpha',
      headers: { 'content-type': 'application/octet-stream' },
      payload: webmHeader,
    })
    const rejected = await server.inject({
      method: 'POST',
      url: '/api/web-composer/exports/video?presetId=viktor&presetVersion=2&width=1920&height=1080&fps=12&durationSeconds=4&videoFormat=avi',
      headers: { 'content-type': 'application/octet-stream' },
      payload: webmHeader,
    })

    expect(accepted.statusCode).toBe(200)
    expect(accepted.json()).toMatchObject({ kind: 'web.render.video', title: '网页合成 透明 MOV：viktor' })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json()).toMatchObject({ ok: false, message: 'videoFormat 仅支持 mp4 或 mov-alpha。' })
  })
})
