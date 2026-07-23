import { describe, expect, it, vi } from 'vitest'

import { recordPreviewFrames } from './previewRecording'

function createRecordingHarness(render = vi.fn(() => ({}) as HTMLCanvasElement)) {
  const track = { stop: vi.fn() }
  const stream = { getTracks: vi.fn(() => [track]) }
  const recorder = {
    ondataavailable: null,
    onerror: null,
    onstop: null,
    start: vi.fn(function (this: { state: string }) {
      this.state = 'recording'
    }),
    state: 'inactive',
    stop: vi.fn(function (this: { onstop: (() => void) | null; state: string }) {
      this.state = 'inactive'
      this.onstop?.()
    }),
  }
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  }

  return {
    options: {
      context: context as unknown as CanvasRenderingContext2D,
      durationSeconds: 1,
      fps: 2,
      height: 720,
      mimeType: 'video/webm',
      onProgress: vi.fn(),
      recorder: recorder as unknown as MediaRecorder,
      renderer: { render },
      stream: stream as unknown as MediaStream,
      waitForNextFrame: vi.fn(async () => undefined),
      width: 1280,
    },
    recorder,
    track,
  }
}

describe('recordPreviewFrames', () => {
  it('records all frames and releases the stream after success', async () => {
    const harness = createRecordingHarness()

    const result = await recordPreviewFrames(harness.options)

    expect(result.type).toBe('video/webm')
    expect(harness.options.renderer.render).toHaveBeenCalledTimes(2)
    expect(harness.options.onProgress).toHaveBeenNthCalledWith(1, 1, 2)
    expect(harness.options.onProgress).toHaveBeenNthCalledWith(2, 2, 2)
    expect(harness.recorder.stop).toHaveBeenCalledOnce()
    expect(harness.track.stop).toHaveBeenCalledOnce()
  })

  it('stops the recorder and stream when rendering a frame fails', async () => {
    const renderError = new Error('frame render failed')
    const harness = createRecordingHarness(vi.fn(() => {
      throw renderError
    }))

    await expect(recordPreviewFrames(harness.options)).rejects.toBe(renderError)

    expect(harness.recorder.stop).toHaveBeenCalledOnce()
    expect(harness.track.stop).toHaveBeenCalledOnce()
    expect(harness.recorder.ondataavailable).toBeNull()
    expect(harness.recorder.onerror).toBeNull()
    expect(harness.recorder.onstop).toBeNull()
  })

  it('surfaces recorder errors and releases resources', async () => {
    const harness = createRecordingHarness()
    harness.options.waitForNextFrame = vi.fn(async () => {
      const onerror = harness.recorder.onerror as null | (() => void)
      onerror?.()
    })

    await expect(recordPreviewFrames(harness.options)).rejects.toThrow('浏览器帧录制失败。')

    expect(harness.recorder.stop).toHaveBeenCalledOnce()
    expect(harness.track.stop).toHaveBeenCalledOnce()
  })
})
