import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

import { buildApiServer } from './app.js'

const execFileAsync = promisify(execFile)
const ffmpegBinary = process.env.MEDIATOOLBOX_FFMPEG_PATH?.trim() || 'ffmpeg'

describe('transcode routes', () => {
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

  it('actually writes a physical output file for a real ffmpeg transcode (regression for virtual-path leak)', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-transcode-workspace-'))
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    try {
      const inputPhysicalPath = path.join(workspaceDir, 'sample-input.mp4')
      await execFileAsync(ffmpegBinary, [
        '-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=5',
        '-pix_fmt', 'yuv420p', inputPhysicalPath,
      ])

      const app = await buildApiServer()
      const created = await app.inject({
        method: 'POST',
        url: '/api/transcode/jobs',
        payload: { inputPath: '/Workspace/sample-input.mp4', outputPath: '/Workspace/Exports/sample-output.mp4', preset: 'copy' },
      })
      expect(created.statusCode).toBe(200)
      const jobId = created.json<{ id: string }>().id

      let status = 'queued'
      for (let attempt = 0; attempt < 100 && status !== 'succeeded' && status !== 'failed'; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        const detail = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
        status = detail.json<{ job: { status: string } }>().job.status
      }

      expect(status).toBe('succeeded')
      const outputPhysicalPath = path.join(workspaceDir, 'Exports', 'sample-output.mp4')
      const stat = await fs.stat(outputPhysicalPath)
      expect(stat.size).toBeGreaterThan(0)
      await app.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
    }
  })

  it('preserves an existing output when the replacement transcode fails', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-transcode-preserve-'))
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    try {
      const exportsDir = path.join(workspaceDir, 'Exports')
      const outputPhysicalPath = path.join(exportsDir, 'existing-output.mp4')
      await fs.mkdir(exportsDir, { recursive: true })
      await fs.writeFile(outputPhysicalPath, 'existing-output')

      const app = await buildApiServer()
      const created = await app.inject({
        method: 'POST',
        url: '/api/transcode/jobs',
        payload: {
          inputPath: '/Workspace/missing-input.mp4',
          outputPath: '/Workspace/Exports/existing-output.mp4',
          preset: 'copy',
        },
      })
      const jobId = created.json<{ id: string }>().id

      let status = 'queued'
      for (let attempt = 0; attempt < 100 && status !== 'succeeded' && status !== 'failed'; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 20))
        const detail = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
        status = detail.json<{ job: { status: string } }>().job.status
      }

      expect(status).toBe('failed')
      expect(await fs.readFile(outputPhysicalPath, 'utf8')).toBe('existing-output')
      expect((await fs.readdir(exportsDir)).filter((name) => name.includes(jobId))).toEqual([])
      await app.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
    }
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

  it('consumes a write grant after first use and rejects reuse (regression for missing one-shot enforcement)', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const app = await buildApiServer()
    const headers = {
      'x-mediatoolbox-desktop': 'desktop',
      'x-mediatoolbox-desktop-token': 'test-desktop-token',
    }
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-write-grant-'))

    const grantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers,
      payload: {
        kind: 'file.write',
        physicalPath: path.join(workspaceDir, 'out.mp4'),
        displayName: 'out.mp4',
      },
    })
    const grantId = grantResponse.json<{ grant: { id: string } }>().grant.id

    const first = await app.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      payload: { inputPath: '/Workspace/README.txt', outputGrantId: grantId, preset: 'copy' },
    })
    expect(first.statusCode).toBe(200)

    // grant 已在第一次真正落盘写入时被消费；第二次复用同一个 grantId 必须被拒绝。
    const second = await app.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      payload: { inputPath: '/Workspace/README.txt', outputGrantId: grantId, preset: 'copy' },
    })
    expect(second.statusCode).toBe(400)

    await app.close()
  })

  it('binds a read grant to its transcode job and revokes it once the job finishes (regression for missing grant lifecycle)', async () => {
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
      payload: { kind: 'file.read', physicalPath: path.resolve('README.md'), displayName: 'README.md' },
    })
    const grantId = grantResponse.json<{ grant: { id: string } }>().grant.id

    const created = await app.inject({
      method: 'POST',
      url: '/api/transcode/jobs',
      payload: { inputGrantId: grantId, outputPath: '/Workspace/Exports/out.mp4', preset: 'copy' },
    })
    const jobId = created.json<{ id: string }>().id

    // 任务创建后 grant 必须已绑定到这个 job（仍处于 active，因为任务还没跑完）。
    const boundGrant = await app.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })
    expect(boundGrant.json<{ grant: { jobId?: string; status: string } }>().grant).toMatchObject({
      jobId,
      status: 'active',
    })

    // 等任务跑到终态（本地没有真实输入文件，ffmpeg 会失败，但失败也是终态）。
    let status = 'queued'
    for (let attempt = 0; attempt < 100 && status !== 'succeeded' && status !== 'failed'; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      const detail = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
      status = detail.json<{ job: { status: string } }>().job.status
    }
    expect(status).toBe('failed')
    const failedDetail = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
    expect(failedDetail.json<{ job: { errorMessage?: string } }>().job.errorMessage).toBeTruthy()

    // job 进入终态后，绑定的 grant 必须被自动吊销，不能无限期存活。
    const afterCompletion = await app.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })
    expect(afterCompletion.statusCode).toBe(404)

    await app.close()
  })

})
