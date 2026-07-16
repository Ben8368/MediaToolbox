import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

import { buildApiServer } from './app.js'

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

  it('keeps the high-frequency runtime endpoint lightweight', async () => {
    const app = await buildApiServer()

    const runtime = await app.inject({ method: 'GET', url: '/api/system/runtime' })
    const body = runtime.json()

    expect(body).toMatchObject({
      runtime: expect.objectContaining({ uptime_seconds: expect.any(Number) }),
      network: expect.objectContaining({
        upload_bytes_per_sec: expect.any(Number),
        download_bytes_per_sec: expect.any(Number),
      }),
    })
    expect(body).not.toHaveProperty('system')
    expect(body).not.toHaveProperty('services')
    expect(body).not.toHaveProperty('tasks')
    await app.close()
  })

  it('never leaks the physical workspace root in a client-facing response (regression for path disclosure)', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-secret-workspace-'))
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    try {
      const app = await buildApiServer()
      const metrics = await app.inject({ method: 'GET', url: '/api/system/metrics' })
      // 反斜杠路径在 JSON 序列化后会被转义（\ -> \\），对原始 body 字符串做 includes 检测不出泄露；
      // 必须在解析后的对象上比较，且用 path.sep 规范化后的片段而不是完整路径，兼容 forward-slash 场景。
      const normalizedLeakFragment = workspaceDir.replace(/\\/g, '/')
      const serialized = JSON.stringify(metrics.json()).replace(/\\\\/g, '/')
      expect(serialized).not.toContain(normalizedLeakFragment)
      await app.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
    }
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

  it('serves a packaged renderer on the same origin as the local API', async () => {
    const rendererRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-renderer-'))
    try {
      await fs.mkdir(path.join(rendererRoot, 'assets'))
      await fs.writeFile(path.join(rendererRoot, 'index.html'), '<!doctype html><title>MediaToolbox</title>')
      await fs.writeFile(path.join(rendererRoot, 'assets', 'main.js'), 'console.log("renderer")')
      const app = await buildApiServer({ rendererRoot })

      const root = await app.inject({ method: 'GET', url: '/' })
      const route = await app.inject({ method: 'GET', url: '/preset/lumora' })
      const asset = await app.inject({ method: 'GET', url: '/assets/main.js' })
      const assetHead = await app.inject({ method: 'HEAD', url: '/assets/main.js' })
      const api = await app.inject({ method: 'GET', url: '/api/health' })

      expect(root.body).toContain('MediaToolbox')
      expect(route.body).toContain('MediaToolbox')
      expect(asset.headers['content-type']).toContain('text/javascript')
      expect(assetHead.statusCode).toBe(200)
      expect(api.json()).toMatchObject({ ok: true, service: 'mediatoolbox-api' })
      await app.close()
    } finally {
      await fs.rm(rendererRoot, { recursive: true, force: true })
    }
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

  it('persists trash entries across API restarts via SQLite (regression for in-memory-only trash)', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-trash-persist-'))
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    const dbPath = path.join(workspaceDir, 'test.db')
    process.env.MEDIATOOLBOX_DB_PATH = dbPath
    try {
      // 第一次启动：创建回收站条目
      const app1 = await buildApiServer()
      await app1.inject({ method: 'DELETE', url: '/api/filebrowser/path', payload: { path: '/Workspace/README.txt', to_trash: true } })
      const trash1 = await app1.inject({ method: 'GET', url: '/api/filebrowser/trash' })
      expect(trash1.json<{ items: Array<{ name: string }> }>().items).toHaveLength(1)
      await app1.close()

      // 第二次启动（复用同一个 db 文件）：回收站条目应仍然存在
      const app2 = await buildApiServer()
      const trash2 = await app2.inject({ method: 'GET', url: '/api/filebrowser/trash' })
      expect(trash2.json<{ items: Array<{ name: string }> }>().items).toHaveLength(1)
      const restored = trash2.json<{ items: Array<{ id: string }> }>().items[0]!.id
      await app2.inject({ method: 'POST', url: `/api/filebrowser/trash/${restored}/restore` })
      const root = await app2.inject({ method: 'POST', url: '/api/filebrowser/list', payload: { directory: '/Workspace' } })
      expect(root.json<{ files: Array<{ name: string }> }>().files.some((f) => f.name === 'README.txt')).toBe(true)
      await app2.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
      delete process.env.MEDIATOOLBOX_DB_PATH
    }
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

  it('revokes grants bound to jobs canceled through the unified endpoint', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const app = await buildApiServer()
    const created = await app.inject({ method: 'POST', url: '/api/jobs', payload: { title: 'Grant owner' } })
    const jobId = created.json<{ id: string }>().id
    const grantResponse = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers: {
        'x-mediatoolbox-desktop': 'desktop',
        'x-mediatoolbox-desktop-token': 'test-desktop-token',
      },
      payload: {
        kind: 'file.read',
        physicalPath: path.resolve('README.md'),
        displayName: 'README.md',
        jobId,
      },
    })
    const grantId = grantResponse.json<{ grant: { id: string } }>().grant.id

    await app.inject({ method: 'POST', url: `/api/jobs/${jobId}/cancel` })
    const grantAfterCancel = await app.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })

    expect(grantAfterCancel.statusCode).toBe(404)
    await app.close()
  })

  it('rejects invalid path-grant lifetimes instead of persisting unusable grants', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const app = await buildApiServer()

    const response = await app.inject({
      method: 'POST',
      url: '/api/path-grants',
      headers: {
        'x-mediatoolbox-desktop': 'desktop',
        'x-mediatoolbox-desktop-token': 'test-desktop-token',
      },
      payload: {
        kind: 'file.read',
        physicalPath: path.resolve('README.md'),
        displayName: 'README.md',
        ttlMs: -1,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ ok: false, message: 'ttlMs 必须是正数。' })
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

  it('rejects shutdown requests carrying the marker but no valid desktop token (regression for spoofable shutdown)', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    const app = await buildApiServer()

    // 只带 marker、不带 token（模拟能从浏览器发起的伪造请求）。
    const markerOnly = await app.inject({
      method: 'POST',
      url: '/api/system/shutdown',
      headers: { 'x-mediatoolbox-shutdown': 'desktop' },
    })
    expect(markerOnly.statusCode).toBe(403)

    // 带错误 token 同样拒绝。
    const wrongToken = await app.inject({
      method: 'POST',
      url: '/api/system/shutdown',
      headers: { 'x-mediatoolbox-shutdown': 'desktop', 'x-mediatoolbox-desktop-token': 'not-the-token' },
    })
    expect(wrongToken.statusCode).toBe(403)

    await app.close()
  })

  it('accepts shutdown requests carrying marker and valid desktop token', async () => {
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    // 成功路径会在 100ms 后调用 process.exit(0)；用假计时器阻止真实退出，避免杀掉测试进程。
    vi.useFakeTimers()
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    try {
      const app = await buildApiServer()

      const response = await app.inject({
        method: 'POST',
        url: '/api/system/shutdown',
        headers: { 'x-mediatoolbox-shutdown': 'desktop', 'x-mediatoolbox-desktop-token': 'test-desktop-token' },
      })
      expect(response.statusCode).toBe(200)
    } finally {
      exitSpy.mockRestore()
      vi.useRealTimers()
    }
  })

})
