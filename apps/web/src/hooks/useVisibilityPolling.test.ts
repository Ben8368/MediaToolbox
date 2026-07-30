import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startVisibilityPolling } from '@/hooks/useVisibilityPolling'

class TestVisibilitySource {
  hidden: boolean
  private listener: EventListener | null = null

  constructor(hidden = false) {
    this.hidden = hidden
  }

  addEventListener(_type: 'visibilitychange', listener: EventListener) {
    this.listener = listener
  }

  removeEventListener(_type: 'visibilitychange', listener: EventListener) {
    if (this.listener === listener) this.listener = null
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden
    this.listener?.(new Event('visibilitychange'))
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startVisibilityPolling', () => {
  it('waits for visibility before starting an initially hidden poller', () => {
    const source = new TestVisibilitySource(true)
    const callback = vi.fn()
    const dispose = startVisibilityPolling(callback, 1_000, source)

    vi.advanceTimersByTime(5_000)
    expect(callback).not.toHaveBeenCalled()

    source.setHidden(false)
    expect(callback).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('aborts the stale generation and starts immediately after visibility resumes', () => {
    const source = new TestVisibilitySource()
    const signals: AbortSignal[] = []
    const callback = vi.fn((signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<void>(() => undefined)
    })
    const dispose = startVisibilityPolling(callback, 1_000, source)

    expect(callback).toHaveBeenCalledTimes(1)
    source.setHidden(true)
    expect(signals[0]?.aborted).toBe(true)

    source.setHidden(false)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(signals[1]?.aborted).toBe(false)

    dispose()
    expect(signals[1]?.aborted).toBe(true)
  })

  it('does not overlap interval callbacks within the same generation', async () => {
    const source = new TestVisibilitySource()
    let resolveCurrent: (() => void) | undefined
    const callback = vi.fn(() => new Promise<void>((resolve) => {
      resolveCurrent = resolve
    }))
    const dispose = startVisibilityPolling(callback, 1_000, source)

    vi.advanceTimersByTime(3_000)
    expect(callback).toHaveBeenCalledTimes(1)

    resolveCurrent?.()
    await Promise.resolve()
    vi.advanceTimersByTime(1_000)
    expect(callback).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('does not carry an in-flight request into a recreated poller', () => {
    const source = new TestVisibilitySource()
    const firstCallback = vi.fn(() => new Promise<void>(() => undefined))
    const disposeFirst = startVisibilityPolling(firstCallback, 1_000, source)

    expect(firstCallback).toHaveBeenCalledTimes(1)
    disposeFirst()

    const secondCallback = vi.fn()
    const disposeSecond = startVisibilityPolling(secondCallback, 1_000, source)
    expect(secondCallback).toHaveBeenCalledTimes(1)
    disposeSecond()
  })
})
