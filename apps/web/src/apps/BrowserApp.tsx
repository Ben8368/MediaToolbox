import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'

import {
  getDesktopBrowserBridge,
  type DesktopBrowserBounds,
  type DesktopBrowserDownloadEvent,
  type DesktopBrowserPermissionEvent,
  type DesktopBrowserResult,
  type DesktopBrowserState,
} from '@/desktopBrowser'
import { useWindowStore } from '@/windowStore'

const HOME_URL = 'about:blank'

const initialState: DesktopBrowserState = {
  id: '',
  sessionId: '',
  url: HOME_URL,
  title: 'Browser',
  loading: false,
  canGoBack: false,
  canGoForward: false,
}

export function BrowserApp() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const bridge = useMemo(() => getDesktopBrowserBridge(), [])
  const windows = useWindowStore((store) => store.windows)
  const maxZ = useMemo(() => Math.max(0, ...windows.map((window) => window.zIndex)), [windows])
  const browserWindow = windows.find((window) => window.appType === 'browser')
  const viewId = browserWindow?.id ?? 'browser'
  const isActive = Boolean(browserWindow && browserWindow.zIndex === maxZ)
  const isVisible = Boolean(browserWindow && !browserWindow.isMinimized && isActive)
  const [address, setAddress] = useState('')
  const [browserState, setBrowserState] = useState<DesktopBrowserState>({ ...initialState, id: viewId })
  const [status, setStatus] = useState({ tone: 'pending', text: '正在连接桌面浏览器内核' })
  const [downloads, setDownloads] = useState<DesktopBrowserDownloadEvent[]>([])
  const [permissions, setPermissions] = useState<DesktopBrowserPermissionEvent[]>([])

  const handleResult = useCallback(<T,>(result: DesktopBrowserResult<T>): T | undefined => {
    if (result.ok) return result.data
    setStatus({ tone: 'error', text: result.error })
    return undefined
  }, [])

  const syncBounds = useCallback((nextVisible = isVisible) => {
    if (!bridge || !hostRef.current) return
    const rect = hostRef.current.getBoundingClientRect()
    const bounds: DesktopBrowserBounds = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }
    const shouldShowNativeView = nextVisible && browserState.url !== HOME_URL && !browserState.error
    void bridge.setBounds(viewId, bounds, shouldShowNativeView).then(handleResult)
  }, [bridge, browserState.error, browserState.url, handleResult, isVisible, viewId])

  useEffect(() => {
    if (!bridge) {
      setStatus({ tone: 'offline', text: '请在 MediaToolbox 桌面端中使用真浏览器' })
      return
    }

    let disposed = false
    void bridge.create(viewId, HOME_URL).then((result) => {
      const state = handleResult(result)
      if (!state || disposed) return
      setBrowserState(state)
      setStatus({ tone: 'ready', text: '浏览器已就绪' })
    })

    const unsubscribe = bridge.onEvent((event) => {
      if (event.type === 'state') {
        if (event.state.id !== viewId) return
        setBrowserState(event.state)
        setAddress(event.state.url === HOME_URL ? '' : event.state.url)
        setStatus(event.state.error
          ? { tone: 'error', text: event.state.error }
          : { tone: event.state.loading ? 'pending' : 'online', text: event.state.loading ? '正在载入' : '页面已载入' })
        return
      }

      if (event.type === 'download') {
        if (event.download.viewId !== viewId) return
        setDownloads((items) => [event.download, ...items.filter((item) => item.id !== event.download.id)].slice(0, 6))
        setStatus({ tone: event.download.status === 'failed' ? 'error' : 'online', text: downloadStatusText(event.download) })
        return
      }

      if (event.type === 'permission') {
        if (event.permission.view_id !== viewId) return
        setPermissions((items) => [event.permission, ...items].slice(0, 4))
      }
    })

    return () => {
      disposed = true
      unsubscribe()
      void bridge.destroy(viewId)
    }
  }, [bridge, handleResult, viewId])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => syncBounds())
    return () => window.cancelAnimationFrame(frame)
  }, [
    browserWindow?.height,
    browserWindow?.isMaximized,
    browserWindow?.isMinimized,
    browserWindow?.width,
    browserWindow?.x,
    browserWindow?.y,
    browserWindow?.zIndex,
    browserState.error,
    browserState.url,
    syncBounds,
  ])

  useEffect(() => {
    if (!hostRef.current) return
    const observer = new ResizeObserver(() => syncBounds())
    const handleResize = () => syncBounds()
    observer.observe(hostRef.current)
    window.addEventListener('resize', handleResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      void bridge?.setBounds(viewId, { x: 0, y: 0, width: 0, height: 0 }, false)
    }
  }, [bridge, syncBounds, viewId])

  const submitNavigation = useCallback((event: FormEvent) => {
    event.preventDefault()
    if (!bridge || !address.trim()) return
    setStatus({ tone: 'pending', text: '正在打开页面' })
    void bridge.navigate(viewId, address).then((result) => {
      const state = handleResult(result)
      if (!state) return
      setBrowserState(state)
      setAddress(state.url === HOME_URL ? '' : state.url)
      syncBounds(true)
    })
  }, [address, bridge, handleResult, syncBounds, viewId])

  const runNavigationAction = useCallback((action: 'goBack' | 'goForward' | 'reload') => {
    if (!bridge) return
    void bridge[action](viewId).then((result) => {
      const state = handleResult(result)
      if (state) setBrowserState(state)
    })
  }, [bridge, handleResult, viewId])

  const downloadCurrentPage = useCallback(() => {
    if (!bridge || browserState.url === HOME_URL || browserState.error) return
    setStatus({ tone: 'pending', text: '正在创建浏览器下载' })
    void bridge.downloadUrl(viewId, browserState.url).then((result) => {
      const state = handleResult(result)
      if (state) setBrowserState(state)
    })
  }, [bridge, browserState.error, browserState.url, handleResult, viewId])

  const cancelDownload = useCallback((downloadId: string) => {
    if (!bridge) return
    void bridge.cancelDownload(downloadId).then(handleResult)
  }, [bridge, handleResult])

  const showOverlay = !bridge || !isActive || browserState.url === HOME_URL || Boolean(browserState.error)

  return (
    <div className="browser-app">
      <aside className="browser-sidebar">
        <div className="browser-type-list">
          <button className="browser-type browser-type--active" type="button" style={{ '--browser-accent': '#7cc4ff' } as CSSProperties}>
            <span className="browser-type__icon">WWW</span>
            <span className="browser-type__text"><strong>浏览器</strong></span>
          </button>
        </div>
          <div className="browser-sidebar-card">
            <span>桌面内核</span>
            <p>页面由 Electron WebContentsView 承载，窗口位置跟随 NAS 桌面同步。</p>
          </div>
          <div className="browser-sidebar-card browser-network-card">
            <span>网络事件</span>
            <div className="browser-network-list">
              {downloads.length === 0 && permissions.length === 0 && <p>暂无下载或权限事件。</p>}
              {downloads.map((download) => (
                <div className="browser-network-item" key={download.id}>
                  <strong>{download.filename}</strong>
                  <small>{downloadStatusText(download)} · {download.targetPath}</small>
                  {download.status === 'running' && (
                    <button type="button" onClick={() => cancelDownload(download.id)}>取消</button>
                  )}
                </div>
              ))}
              {permissions.map((permission, index) => (
                <div className="browser-network-item browser-network-item--permission" key={`${permission.session_id}-${permission.permission}-${index}`}>
                  <strong>{permission.permission}</strong>
                  <small>{permission.decision === 'granted' ? '已允许' : '已拒绝'} · {permission.origin}</small>
                </div>
              ))}
            </div>
          </div>
        </aside>

      <section className="browser-panel">
        <div className="browser-commandbar">
          <div className="browser-nav-controls">
            <button className="browser-icon-button" type="button" title="后退" disabled={!browserState.canGoBack} onClick={() => runNavigationAction('goBack')}>
              <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button className="browser-icon-button" type="button" title="前进" disabled={!browserState.canGoForward} onClick={() => runNavigationAction('goForward')}>
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <button className="browser-icon-button" type="button" title="刷新" disabled={!bridge} onClick={() => runNavigationAction('reload')}>
              <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>
            </button>
            <button
              className="browser-icon-button"
              type="button"
              title="下载当前页"
              disabled={!bridge || browserState.url === HOME_URL || Boolean(browserState.error)}
              onClick={downloadCurrentPage}
            >
              <svg viewBox="0 0 24 24"><path d="M12 4v10M7 9l5 5 5-5M5 20h14" /></svg>
            </button>
          </div>

          <form className="browser-nav-form" onSubmit={submitNavigation}>
            <label className="browser-addressbar">
              <span className={`browser-addressbar__monitor browser-addressbar__monitor--${status.tone}`}>
                <i />
                {status.tone === 'online' ? 'LIVE' : status.tone.toUpperCase()}
              </span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="输入网址或本地服务地址"
                spellCheck={false}
              />
            </label>
            <button className="browser-primary" type="submit" disabled={!bridge || !address.trim()}>打开</button>
          </form>
        </div>

        <div className={`browser-status ${status.tone === 'error' ? 'browser-status--error' : ''}`}>
          <span>{browserState.title && browserState.url !== HOME_URL ? browserState.title : status.text}</span>
        </div>

        <div className="browser-stage">
          <div
            ref={hostRef}
            className="browser-frame browser-native-host"
            onMouseDown={() => {
              if (bridge && isActive) void bridge.focus(viewId)
            }}
          >
            {showOverlay && (
              <div className="browser-empty">
                <div className="browser-empty__mark">WWW</div>
                <strong>{bridge ? '输入地址开始浏览' : '桌面端能力未连接'}</strong>
                <p>{bridge ? (isActive ? status.text : '点击浏览器窗口后会显示真实网页内容。') : '真浏览器需要 Electron preload 与主进程 IPC 支持，纯 Web 模式不会创建本机浏览器视图。'}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function downloadStatusText(download: DesktopBrowserDownloadEvent): string {
  if (download.status === 'succeeded') return '已完成'
  if (download.status === 'failed') return download.error || '下载失败'
  if (download.status === 'canceled') return '已取消'
  if (download.totalBytes <= 0) return `下载中 ${formatBytes(download.receivedBytes)}`
  const percent = Math.round((download.receivedBytes / download.totalBytes) * 100)
  return `下载中 ${percent}%`
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`
  return `${Math.round(value / 1024 / 102.4) / 10} MB`
}
