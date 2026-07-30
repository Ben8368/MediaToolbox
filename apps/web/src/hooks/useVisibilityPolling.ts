import { useEffect, useRef } from 'react'

type PollingCallback = (signal: AbortSignal) => void | Promise<void>
type VisibilitySource = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>

export function startVisibilityPolling(
  callback: PollingCallback,
  intervalMs: number,
  visibilitySource: VisibilitySource = document,
) {
  let interval: ReturnType<typeof setInterval> | null = null
  let activeController: AbortController | null = null
  let disposed = false

  async function run() {
    if (disposed || visibilitySource.hidden || activeController) return

    const controller = new AbortController()
    activeController = controller
    try {
      await callback(controller.signal)
    } catch {
      // Polling callbacks own their user-facing error state; keep the loop alive.
    } finally {
      if (activeController === controller) activeController = null
    }
  }

  function start() {
    if (disposed || visibilitySource.hidden || interval) return
    void run()
    interval = setInterval(() => void run(), intervalMs)
  }

  function pause() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
    activeController?.abort()
    activeController = null
  }

  function onVisibilityChange() {
    if (visibilitySource.hidden) {
      pause()
      return
    }
    start()
  }

  visibilitySource.addEventListener('visibilitychange', onVisibilityChange)
  start()

  return () => {
    disposed = true
    pause()
    visibilitySource.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

/** 页面可见时按间隔轮询，隐藏时暂停并在恢复可见时立即执行一次 */
export function useVisibilityPolling(callback: PollingCallback, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    return startVisibilityPolling((signal) => callbackRef.current(signal), intervalMs)
  }, [enabled, intervalMs])
}
