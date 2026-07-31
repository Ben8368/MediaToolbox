import fs from 'node:fs/promises'
import path from 'node:path'
import { FfmpegRunError } from '@mediatoolbox/ffmpeg'
import { createJobRecord } from '@mediatoolbox/job-core'
import { describe, expect, it, vi } from 'vitest'

const workerMocks = vi.hoisted(() => ({ run: vi.fn() }))

vi.mock('@mediatoolbox/transcode-worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mediatoolbox/transcode-worker')>()
  return { ...actual, runTranscodeWorkerJob: workerMocks.run }
})

import { createApiState } from './state.js'
import { executeTranscode } from './transcode-executor.js'

describe('transcode executor retries', () => {
  it('retries normalized transient failures and commits one stable output', async () => {
    const state = createApiState()
    const job = createJobRecord({
      id: 'transcode-retry-test',
      kind: 'media.transcode',
      title: 'retry transcode',
      maxAttempts: 3,
      outputToken: 'stable-output-token',
    })
    const inputPath = path.join(state.physicalWorkspaceRoot, 'input.mp4')
    const outputPath = path.join(state.physicalWorkspaceRoot, 'Exports', 'retry-output.mp4')
    await fs.writeFile(inputPath, 'input')
    await state.db.jobs.create(job)

    workerMocks.run
      .mockRejectedValueOnce(new FfmpegRunError({
        normalized: { code: 'unknown', message: 'temporary encoder failure', retryable: true },
        exitCode: 1,
        stderr: 'temporary encoder failure',
      }))
      .mockImplementationOnce(async (workerJob: { outputPath: string }) => {
        await fs.writeFile(workerJob.outputPath, 'encoded')
        return { status: 'succeeded', command: 'ffmpeg', args: [], exitCode: 0, events: [] }
      })

    await executeTranscode(
      job,
      { inputPath, outputPath, preset: 'copy' },
      state,
      '/Workspace/Exports/retry-output.mp4',
      new AbortController().signal,
    )

    expect(workerMocks.run).toHaveBeenCalledTimes(2)
    await expect(state.db.jobs.findById(job.id)).resolves.toMatchObject({
      status: 'succeeded',
      attempt: 2,
      maxAttempts: 3,
      outputToken: 'stable-output-token',
    })
    await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe('encoded')
    expect((await fs.readdir(path.dirname(outputPath))).some((name) => name.includes('stable-output-token'))).toBe(false)
    state.db.close()
  })
})
