import type {
  DesktopBrowserDownloadEvent,
  DesktopBrowserPermissionEvent,
  DesktopBrowserState,
  DesktopBrowserUploadSelection,
} from '@/desktopBrowser'

export const HOME_URL = 'about:blank'

export type BrowserStatusTone = 'ready' | 'online' | 'pending' | 'offline' | 'error'

export type BrowserTab = {
  /** Stable view id shared with the desktop bridge; unique per window. */
  viewId: string
  state: DesktopBrowserState
  address: string
  /** True once bridge.create resolved for this tab's view. */
  created: boolean
}

export function initialBrowserState(viewId: string): DesktopBrowserState {
  return {
    id: viewId,
    sessionId: '',
    url: HOME_URL,
    title: 'Browser',
    loading: false,
    canGoBack: false,
    canGoForward: false,
  }
}

export function createTab(viewId: string): BrowserTab {
  return { viewId, state: initialBrowserState(viewId), address: '', created: false }
}

/** Replace the tab matching viewId with patched fields; identity preserved for others. */
export function patchTab(tabs: BrowserTab[], viewId: string, patch: Partial<BrowserTab>): BrowserTab[] {
  return tabs.map((tab) => (tab.viewId === viewId ? { ...tab, ...patch } : tab))
}

/**
 * Remove the tab at viewId and choose the next active id: prefer the right
 * neighbour, then the left. Never returns an empty list — the caller keeps at
 * least one tab so the window always has content.
 */
export function closeTab(tabs: BrowserTab[], viewId: string, activeId: string): {
  tabs: BrowserTab[]
  activeId: string
  closed: BrowserTab | null
} {
  const index = tabs.findIndex((tab) => tab.viewId === viewId)
  if (index === -1 || tabs.length <= 1) return { tabs, activeId, closed: null }

  const closed = tabs[index] ?? null
  const nextTabs = tabs.filter((tab) => tab.viewId !== viewId)
  let nextActive = activeId
  if (activeId === viewId) {
    const neighbour = nextTabs[index] ?? nextTabs[index - 1]
    nextActive = neighbour?.viewId ?? nextTabs[0]!.viewId
  }
  return { tabs: nextTabs, activeId: nextActive, closed }
}

/** Short label for a tab strip: page title, then host, then a placeholder. */
export function tabTitle(tab: BrowserTab): string {
  if (tab.state.error) return '加载失败'
  if (tab.state.url && tab.state.url !== HOME_URL) {
    if (tab.state.title && tab.state.title !== 'Browser') return tab.state.title
    try {
      return new URL(tab.state.url).host || '新标签页'
    } catch {
      return tab.state.url
    }
  }
  return '新标签页'
}

export function downloadStatusText(download: DesktopBrowserDownloadEvent): string {
  if (download.status === 'succeeded') return '已完成'
  if (download.status === 'failed') return download.error || '下载失败'
  if (download.status === 'canceled') return '已取消'
  if (download.totalBytes <= 0) return `下载中 ${formatBytes(download.receivedBytes)}`
  const percent = Math.round((download.receivedBytes / download.totalBytes) * 100)
  return `下载中 ${percent}%`
}

export function filterDownloadsByView(downloads: DesktopBrowserDownloadEvent[], viewId: string): DesktopBrowserDownloadEvent[] {
  return downloads.filter((download) => download.viewId === viewId)
}

export function filterPermissionsByView(permissions: DesktopBrowserPermissionEvent[], viewId: string): DesktopBrowserPermissionEvent[] {
  return permissions.filter((permission) => permission.view_id === viewId)
}

export function filterUploadsByView(uploads: DesktopBrowserUploadSelection[], viewId: string): DesktopBrowserUploadSelection[] {
  return uploads.filter((upload) => upload.view_id === viewId)
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`
  return `${Math.round(value / 1024 / 102.4) / 10} MB`
}

export function normalizeBrowserAddress(raw: string): string | null {
  let input = raw.trim()
  if (!input) return null
  if (input === HOME_URL) return HOME_URL

  const explicitScheme = input.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase()
  if (explicitScheme && explicitScheme !== 'http' && explicitScheme !== 'https') return null

  if (!explicitScheme) {
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(input)
    input = `${isLocal ? 'http' : 'https'}://${input}`
  }

  try {
    const url = new URL(input)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
