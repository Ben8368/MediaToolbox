import { useMemo, type CSSProperties } from 'react'

import { BrowserTabBar } from '@/apps/browser/BrowserTabBar'
import { HOME_URL, downloadStatusText } from '@/apps/browser/helpers'
import { useBrowserTabs } from '@/apps/browser/useBrowserTabs'
import { ResizableAppSidebar } from '@/components/ResizableAppSidebar'
import { useWindowStore } from '@/windowStore'

export function BrowserApp() {
  const windows = useWindowStore((store) => store.windows)
  const openWindow = useWindowStore((store) => store.openWindow)
  const maxZ = useMemo(() => Math.max(0, ...windows.map((window) => window.zIndex)), [windows])
  const browserWindow = windows.find((window) => window.appType === 'browser')
  const isActive = Boolean(browserWindow && browserWindow.zIndex === maxZ)

  const {
    hostRef,
    tabs,
    activeId,
    activeTab,
    status,
    downloads,
    permissions,
    uploads,
    hasBridge,
    showOverlay,
    openTab,
    selectTab,
    requestCloseTab,
    setActiveAddress,
    submitNavigation,
    runNavigationAction,
    downloadCurrentPage,
    cancelDownload,
    selectUploadFile,
    focusActive,
  } = useBrowserTabs(browserWindow, isActive)

  const state = activeTab?.state
  const address = activeTab?.address ?? ''
  const atHome = !state || state.url === HOME_URL
  const hasError = Boolean(state?.error)
  const actionsDisabled = !hasBridge || atHome || hasError

  return (
    <div className="browser-app">
      <ResizableAppSidebar className="browser-sidebar" storageKey="browser">
        <div className="browser-type-list">
          <button className="browser-type browser-type--active" type="button" style={{ '--browser-accent': '#7cc4ff' } as CSSProperties}>
            <span className="browser-type__icon">WWW</span>
            <span className="browser-type__text"><strong>Scry浏览器</strong></span>
          </button>
        </div>
        <div className="browser-sidebar-card">
          <span>桌面内核</span>
          <p>页面由 Electron WebContentsView 承载，多标签共享同一窗口位置同步。</p>
        </div>
        <div className="browser-sidebar-card browser-network-card">
          <span>网络事件</span>
          <div className="browser-network-list">
            {downloads.length === 0 && permissions.length === 0 && uploads.length === 0 && <p>暂无下载、上传或权限事件。</p>}
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
            {uploads.map((upload, index) => (
              <div className="browser-network-item browser-network-item--upload" key={`${upload.session_id}-${upload.path}-${index}`}>
                <strong>{upload.filename}</strong>
                <small>{upload.confirmed ? '已确认' : '已取消'} · {upload.path}</small>
              </div>
            ))}
          </div>
        </div>
      </ResizableAppSidebar>

      <section className="browser-panel">
        <BrowserTabBar
          tabs={tabs}
          activeId={activeId}
          disabled={!hasBridge}
          onSelect={selectTab}
          onClose={requestCloseTab}
          onOpen={openTab}
        />

        <div className="browser-commandbar">
          <div className="browser-nav-controls">
            <button className="browser-icon-button" type="button" title="后退" disabled={!state?.canGoBack} onClick={() => runNavigationAction('goBack')}>
              <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button className="browser-icon-button" type="button" title="前进" disabled={!state?.canGoForward} onClick={() => runNavigationAction('goForward')}>
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <button className="browser-icon-button" type="button" title="刷新" disabled={!hasBridge} onClick={() => runNavigationAction('reload')}>
              <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>
            </button>
            <button className="browser-icon-button" type="button" title="下载当前页" disabled={actionsDisabled} onClick={downloadCurrentPage}>
              <svg viewBox="0 0 24 24"><path d="M12 4v10M7 9l5 5 5-5M5 20h14" /></svg>
            </button>
            <button className="browser-icon-button" type="button" title="选择工作区上传文件" disabled={actionsDisabled} onClick={selectUploadFile}>
              <svg viewBox="0 0 24 24"><path d="M12 20V10M7 15l5-5 5 5M5 4h14" /></svg>
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
                onChange={(event) => setActiveAddress(event.target.value)}
                placeholder="输入网址或本地服务地址"
                spellCheck={false}
              />
            </label>
            <button className="browser-primary" type="submit" disabled={!hasBridge || !address.trim()}>打开</button>
          </form>
        </div>

        <div className={`browser-status ${status.tone === 'error' ? 'browser-status--error' : ''}`}>
          <span>{state?.title && state.url !== HOME_URL ? state.title : status.text}</span>
        </div>

        <div className="browser-stage">
          <div ref={hostRef} className="browser-frame browser-native-host" onMouseDown={focusActive}>
            {showOverlay && (
              <div className="browser-empty">
                {hasError ? (
                  <>
                    <div className="browser-empty__mark browser-empty__mark--error">⚠</div>
                    <strong>页面加载失败</strong>
                    <p>{state?.error}</p>
                    <button className="mt-btn mt-btn--primary" type="button" onClick={() => runNavigationAction('reload')} disabled={!hasBridge}>
                      重试
                    </button>
                  </>
                ) : hasBridge ? (
                  <>
                    <div className="browser-empty__mark">WWW</div>
                    <strong>输入地址开始浏览</strong>
                    <p>{isActive ? status.text : '点击浏览器窗口后会显示真实网页内容。'}</p>
                  </>
                ) : (
                  <>
                    <div className="browser-empty__mark">WWW</div>
                    <strong>请在桌面客户端中使用真浏览器</strong>
                    <p>纯 Web 模式不能创建本机浏览器视图，也不会读取浏览器 Cookie 或会话。媒体下载仍可在当前 Web 桌面中完成。</p>
                    <div className="browser-empty__fallback">
                      <span>需要下载视频、音频或字幕？</span>
                      <button className="mt-btn mt-btn--primary" type="button" onClick={() => openWindow('fetcher')}>打开下载器</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
