import fs from 'node:fs/promises'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import type { FetchTaskRecord } from '@mediatoolbox/contracts'

import { registerFetchRoutes } from './fetch.js'
import { createApiState } from '../state.js'
import { toPhysicalWorkspacePath } from '../workspace-files.js'

describe('fetch task file access', () => {
  it('serves recorded workspace output files', async () => {
    const app = Fastify()
    const state = createApiState()
    registerFetchRoutes(app, state)

    const virtualPath = `${state.workspaceRoot}/Downloads/result.txt`
    await fs.writeFile(toPhysicalWorkspacePath(state, virtualPath), 'downloaded file', 'utf8')
    state.fetchTasks.push(createCompletedTask('fetch-file-1', virtualPath))

    const response = await app.inject({ method: 'GET', url: '/api/fetch/tasks/fetch-file-1/file' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toContain('result.txt')
    expect(response.body).toBe('downloaded file')
    await app.close()
  })

  it('returns a readable 404 when the task has no recorded output', async () => {
    const app = Fastify()
    const state = createApiState()
    registerFetchRoutes(app, state)
    state.fetchTasks.push(createCompletedTask('fetch-file-2'))

    const response = await app.inject({ method: 'GET', url: '/api/fetch/tasks/fetch-file-2/file' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ ok: false, message: '任务尚未记录可下载文件。' })
    await app.close()
  })

  it('rejects workspace files that are not recorded on the task', async () => {
    const app = Fastify()
    const state = createApiState()
    registerFetchRoutes(app, state)

    const recordedPath = `${state.workspaceRoot}/Downloads/result.txt`
    const otherPath = `${state.workspaceRoot}/README.txt`
    state.fetchTasks.push(createCompletedTask('fetch-file-3', recordedPath))

    const response = await app.inject({
      method: 'GET',
      url: `/api/fetch/tasks/fetch-file-3/file?path=${encodeURIComponent(otherPath)}`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ ok: false, message: '请求文件不属于该下载任务。' })
    await app.close()
  })
})

function createCompletedTask(id: string, outputFile?: string): FetchTaskRecord {
  return {
    id,
    task_id: id,
    title: 'download',
    source_url: 'https://example.com/file',
    status: 'completed',
    progress: 100,
    stage: '下载完成',
    created_at: 1,
    updated_at: 1,
    started_at: 1,
    completed_at: 1,
    params: { url: 'https://example.com/file' },
    ...(outputFile ? { output_files: [outputFile] } : {}),
  }
}
