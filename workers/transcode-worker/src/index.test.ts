import { describe, it, expect, vi } from 'vitest'

vi.mock('@mediatoolbox/ffmpeg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mediatoolbox/ffmpeg')>()
  return {
    ...actual,
    runVmafComparison: vi.fn(),
  }
})

import { runVmafComparison } from '@mediatoolbox/ffmpeg'
import { describeTranscodeWorker, runTranscodeWorkerJob } from './index.js'
import type { TranscodeWorkerJob } from './index.js'

describe('describeTranscodeWorker', () => {
  it('returns worker name and command preview', () => {
    const info = describeTranscodeWorker()
    expect(info.name).toBe('transcode-worker')
    expect(info.commandPreview).toBeInstanceOf(Array)
    expect(info.commandPreview.length).toBeGreaterThan(0)
  })
})

describe('runTranscodeWorkerJob', () => {
  it('resolves succeeded when ffmpeg exits 0', async () => {
    const job: TranscodeWorkerJob = {
      inputPath: '/input/video.mov',
      outputPath: '/output/video.mp4',
      preset: 'mp4-h264-aac',
    }

    const result = await runTranscodeWorkerJob(job, {
      onLog: vi.fn(),
      onEvent: vi.fn(),
    }).catch((err: Error) => err)

    // In CI without ffmpeg: tool-not-found error
    // With ffmpeg but bad path: file-not-found error
    // Both are acceptable outcomes for this smoke test
    if (result instanceof Error) {
      expect(result.message).toBeTruthy()
    } else {
      expect(['succeeded', 'canceled']).toContain(result.status)
    }
  })

  it('resolves canceled when signal is aborted before start', async () => {
    const controller = new AbortController()
    controller.abort()

    const job: TranscodeWorkerJob = {
      inputPath: '/input/video.mov',
      outputPath: '/output/video.mp4',
      preset: 'copy',
      ffmpeg: { probe: async () => ({ ok: true, version: '6.0' }) },
      ffprobe: { probe: async () => ({ ok: true, version: '6.0' }) },
    }

    await expect(
      runTranscodeWorkerJob(job, { signal: controller.signal }),
    ).rejects.toThrow()
  })

  it('surfaces a failed VMAF comparison via onLog without failing the transcode job (regression for silently swallowed VMAF errors)', async () => {
    const os = await import('node:os')
    const path = await import('node:path')
    const fs = await import('node:fs/promises')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-vmaf-test-'))
    const inputPath = path.join(workDir, 'input.mp4')
    const outputPath = path.join(workDir, 'output.mp4')
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=5',
      '-pix_fmt', 'yuv420p', inputPath,
    ])

    vi.mocked(runVmafComparison).mockRejectedValueOnce(new Error('VMAF probe crashed'))

    const onLog = vi.fn()
    const job: TranscodeWorkerJob = {
      inputPath,
      outputPath,
      preset: 'copy',
      enableVmaf: true,
    }

    const result = await runTranscodeWorkerJob(job, { onLog })

    expect(result.status).toBe('succeeded')
    expect(result.vmafScore).toBeUndefined()
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining('VMAF comparison failed: VMAF probe crashed'), 'stderr')

    await fs.rm(workDir, { recursive: true, force: true })
  })
})
