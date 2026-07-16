import { describe, expect, it, vi } from 'vitest'

import { ExecutorRegistry } from './executor-registry.js'

describe('ExecutorRegistry', () => {
  it('tracks an executor until its cleanup finishes', async () => {
    const registry = new ExecutorRegistry()
    let release: (() => void) | undefined
    const promise = registry.run('job-1', async () => {
      await new Promise<void>((resolve) => { release = resolve })
    })

    await Promise.resolve()
    expect(registry.size).toBe(1)

    release?.()
    await promise
    expect(registry.size).toBe(0)
  })

  it('aborts active executors and waits for their cleanup before shutdown resolves', async () => {
    const registry = new ExecutorRegistry()
    const cleanup = vi.fn()
    const promise = registry.run('job-2', async (signal) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
      cleanup()
    })

    await Promise.resolve()
    await registry.shutdown()
    await promise

    expect(cleanup).toHaveBeenCalledOnce()
    expect(registry.size).toBe(0)
    expect(registry.isClosing).toBe(true)
    await expect(registry.run('job-3', async () => undefined)).rejects.toThrow('shutting down')
  })
})
