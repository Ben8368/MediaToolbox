import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createJobRecord, startJobAttempt } from '@mediatoolbox/job-core'
import { SqliteDatabase } from '@mediatoolbox/db'
import type { FetchTaskRecord } from '@mediatoolbox/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workerMocks = vi.hoisted(() => ({
  download: vi.fn(),
  transcode: vi.fn(),
}))

vi.mock('@mediatoolbox/download-worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mediatoolbox/download-worker')>()
  return { ...actual, runDownloadWorkerJob: workerMocks.download }
})

vi.mock('@mediatoolbox/transcode-worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mediatoolbox/transcode-worker')>()
  return { ...actual, runTranscodeWorkerJob: workerMocks.transcode }
})

import { buildApiServer } from './app.js'
import { downloadExecution, transcodeExecution } from './job-execution-payload.js'

beforeEach(() => {
  workerMocks.download.mockReset()
  workerMocks.transcode.mockReset()
})

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

  it('resumes a persisted download execution after an unclean restart', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-download-resume-'))
    const dbPath = path.join(workspaceDir, 'test.db')
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    process.env.MEDIATOOLBOX_DB_PATH = dbPath
    workerMocks.download.mockResolvedValue({ status: 'succeeded', command: 'yt-dlp', args: [], exitCode: 0, events: [] })
    try {
      const job = startJobAttempt(createJobRecord({
        id: 'fetch-resume-test',
        kind: 'download.video',
        title: '恢复下载',
        maxAttempts: 3,
      }))
      const task: FetchTaskRecord = {
        id: job.id,
        task_id: job.id,
        title: job.title,
        source_url: 'https://example.com/video',
        status: 'running',
        progress: 20,
        stage: '下载中',
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        started_at: job.updatedAt,
        completed_at: null,
        params: { url: 'https://example.com/video', urls: ['https://example.com/video'], mode: 'video', output_dir: '/Workspace/Downloads' },
      }
      const db = new SqliteDatabase(dbPath)
      await db.jobs.create(job, downloadExecution(task))
      db.close()

      const app = await buildApiServer()
      const resumed = await waitForJobStatus(app, job.id, 'succeeded')
      expect(resumed).toMatchObject({ status: 'succeeded', attempt: 2, outputToken: job.outputToken })
      expect(workerMocks.download).toHaveBeenCalledTimes(1)
      const history = await app.inject({ method: 'GET', url: '/api/fetch/tasks/history' })
      expect(history.json<{ tasks: FetchTaskRecord[] }>().tasks).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: job.id, status: 'completed' })]),
      )
      await app.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
      delete process.env.MEDIATOOLBOX_DB_PATH
    }
  })

  it('resumes a persisted transcode and replaces interrupted staging files safely', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-transcode-resume-'))
    const dbPath = path.join(workspaceDir, 'test.db')
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    process.env.MEDIATOOLBOX_DB_PATH = dbPath
    try {
      const physicalRoot = workspaceDir
      const inputPath = path.join(physicalRoot, 'input.mp4')
      const outputPath = path.join(physicalRoot, 'Exports', 'output.mp4')
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(inputPath, 'input')
      await fs.writeFile(outputPath, 'previous-output')
      const job = startJobAttempt(createJobRecord({
        id: 'transcode-resume-test',
        kind: 'media.transcode',
        title: '恢复转码',
        maxAttempts: 3,
        outputToken: 'stable-resume-token',
      }))
      const workerJob = { inputPath, outputPath, preset: 'copy' as const }
      const db = new SqliteDatabase(dbPath)
      await db.jobs.create(job, transcodeExecution(workerJob, '/Workspace/input.mp4', '/Workspace/Exports/output.mp4'))
      db.close()

      workerMocks.transcode.mockImplementation(async (payload: { outputPath: string }) => {
        await fs.writeFile(payload.outputPath, 'resumed-output')
        return { status: 'succeeded', command: 'ffmpeg', args: [], exitCode: 0, events: [] }
      })
      const app = await buildApiServer()
      const resumed = await waitForJobStatus(app, job.id, 'succeeded')
      expect(resumed).toMatchObject({ status: 'succeeded', attempt: 2, outputToken: 'stable-resume-token' })
      await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe('resumed-output')
      expect((await fs.readdir(path.dirname(outputPath))).some((name) => name.includes('stable-resume-token'))).toBe(false)
      await app.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
      delete process.env.MEDIATOOLBOX_DB_PATH
    }
  })

  it('fails an interrupted execution safely when its retry budget is exhausted', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-resume-exhausted-'))
    const dbPath = path.join(workspaceDir, 'test.db')
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    process.env.MEDIATOOLBOX_DB_PATH = dbPath
    try {
      const queued = createJobRecord({
        id: 'fetch-exhausted-test',
        kind: 'download.video',
        title: '次数耗尽下载',
        maxAttempts: 1,
      })
      const job = startJobAttempt(queued)
      const task: FetchTaskRecord = {
        id: job.id,
        task_id: job.id,
        title: job.title,
        source_url: 'https://example.com/video',
        status: 'running',
        progress: 20,
        stage: '下载中',
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        started_at: job.updatedAt,
        completed_at: null,
        params: { url: 'https://example.com/video', mode: 'video', output_dir: '/Workspace/Downloads' },
      }
      const db = new SqliteDatabase(dbPath)
      await db.jobs.create(job, downloadExecution(task))
      db.close()

      const app = await buildApiServer()
      const detail = await app.inject({ method: 'GET', url: `/api/jobs/${job.id}` })
      expect(detail.json()).toMatchObject({
        job: { status: 'failed', attempt: 1, errorMessage: expect.stringContaining('API 重启导致任务中断') },
      })
      expect(workerMocks.download).not.toHaveBeenCalled()
      await app.close()
    } finally {
      delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
      delete process.env.MEDIATOOLBOX_DB_PATH
    }
  })
})

async function waitForJobStatus(
  app: Awaited<ReturnType<typeof buildApiServer>>,
  jobId: string,
  status: string,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}` })
    const job = response.json<{ job: { status: string } }>().job
    if (job.status === status) return job
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Job ${jobId} did not reach ${status}.`)
}
