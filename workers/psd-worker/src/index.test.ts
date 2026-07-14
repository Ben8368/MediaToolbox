import { describe, expect, it, vi } from 'vitest'

import { runPsdWorkerJob } from './index.js'

describe('runPsdWorkerJob cancellation', () => {
  it('rejects before invoking Photoshop when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const runner = vi.fn(async () => '')

    await expect(runPsdWorkerJob({ type: 'list-fonts' }, runner, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(runner).not.toHaveBeenCalled()
  })

  it('forwards the signal to the Photoshop runner', async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | undefined
    const runner = vi.fn((_script: string, options?: { signal?: AbortSignal }) => new Promise<string>((_resolve, reject) => {
      receivedSignal = options?.signal
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))

    const pending = runPsdWorkerJob({ type: 'list-fonts' }, runner, { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(receivedSignal).toBe(controller.signal)
  })
})
