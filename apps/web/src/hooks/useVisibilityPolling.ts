import { useEffect, useRef } from 'react'

type PollingCallback = () => void | Promise<void>

/** 页面可见时按间隔轮询，隐藏时暂停并在恢复可见时立即执行一次 */
export function useVisibilityPolling(callback: PollingCallback, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback)
  const inFlightRef = useRef(false)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let interval: ReturnType<typeof setInterval> | null = null

    async function run() {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        await callbackRef.current()
      } catch {
        // Polling callbacks own their user-facing error state; keep the loop alive.
      } finally {
        inFlightRef.current = false
      }
    }

    function startPolling() {
      if (interval) return
      interval = setInterval(run, intervalMs)
    }

    function stopPolling() {
      if (!interval) return
      clearInterval(interval)
      interval = null
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopPolling()
        return
      }
      run()
      startPolling()
    }

    run()
    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, intervalMs])
}
