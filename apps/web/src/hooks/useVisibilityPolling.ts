import { useEffect, useRef } from 'react'

type PollingCallback = () => void | Promise<void>

/** 页面可见时按间隔轮询，隐藏时暂停并在恢复可见时立即执行一次 */
export function useVisibilityPolling(callback: PollingCallback, intervalMs: number) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    function run() {
      void callbackRef.current()
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
  }, [intervalMs])
}
