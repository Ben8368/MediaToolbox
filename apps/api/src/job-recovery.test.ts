import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { buildApiServer } from './app.js'

describe('job restart recovery', () => {
  it('marks orphaned active jobs failed and revokes their grants after restart', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-job-recovery-'))
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    process.env.MEDIATOOLBOX_DB_PATH = path.join(workspaceDir, 'test.db')
    process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN = 'test-desktop-token'
    try {
      const app1 = await buildApiServer()
      const created = await app1.inject({ method: 'POST', url: '/api/jobs', payload: { title: 'Interrupted job' } })
      const jobId = created.json<{ id: string }>().id
      const grantResponse = await app1.inject({
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
      await app1.close()

      const app2 = await buildApiServer()
      const detail = await app2.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
      const grant = await app2.inject({ method: 'GET', url: `/api/path-grants/${grantId}` })
      const logs = await app2.inject({ method: 'GET', url: '/api/logs' })

      expect(detail.json()).toMatchObject({
        job: { status: 'failed', errorMessage: expect.stringContaining('API 重启导致任务中断') },
      })
      expect(grant.statusCode).toBe(404)
      expect(logs.json<{ items: Array<{ event: string }> }>().items).toEqual(
        expect.arrayContaining([expect.objectContaining({ event: '恢复中断任务' })]),
      )
      await app2.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
      delete process.env.MEDIATOOLBOX_DB_PATH
      delete process.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN
    }
  })

  it('creates concurrent manual jobs with unique IDs under a frozen clock', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-15T00:00:00Z').getTime())
    const app = await buildApiServer()
    try {
      const responses = await Promise.all(Array.from({ length: 100 }, (_, index) => app.inject({
        method: 'POST',
        url: '/api/jobs',
        payload: { title: `Concurrent job ${index}` },
      })))
      const ids = responses.map((response) => response.json<{ id: string }>().id)
      expect(responses.every((response) => response.statusCode === 200)).toBe(true)
      expect(new Set(ids).size).toBe(ids.length)
    } finally {
      await app.close()
      dateNow.mockRestore()
    }
  })
})
