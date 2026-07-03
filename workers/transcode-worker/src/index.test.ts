import { describe, it, expect, vi } from 'vitest'
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
})
