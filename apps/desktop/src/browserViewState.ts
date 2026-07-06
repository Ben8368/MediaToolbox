import type { IpcMainInvokeEvent } from 'electron'

import { emitPermissionEvent } from './browserNetworkShared.js'
import { getStringField, isNavigationAbortError, normalizeBrowserUrl } from './browserViewPayload.js'

export type ElectronModule = typeof import('electron')
export type BrowserHostWindow = import('electron').BrowserWindow
export type BrowserWebContentsView = import('electron').WebContentsView

export type BrowserViewState = {
  id: string
  sessionId: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: string | undefined
}

export type BrowserViewRecord = {
  id: string
  sessionId: string
  networkOptions: { apiUrl: string; rootDir: string; env?: NodeJS.ProcessEnv }
  view: BrowserWebContentsView
  state: BrowserViewState
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const browserViews = new Map<string, BrowserViewRecord>()

export function assertBrowserSender(event: IpcMainInvokeEvent, hostWindow: BrowserHostWindow): void {
  if (event.sender.id !== hostWindow.webContents.id) {
    throw new Error('Browser IPC rejected from unknown sender')
  }
}

export function configureBrowserView(electron: ElectronModule, hostWindow: BrowserHostWindow, record: BrowserViewRecord): string | undefined {
  const webContents = getWebContents(record)
  if (!webContents) return 'Browser web contents unavailable'

  webContents.setWindowOpenHandler(({ url }) => {
    const normalized = normalizeBrowserUrl(url)
    if (normalized) {
      emitPopupPolicyEvent(electron, hostWindow, record, url, true, 'Popup redirected into the managed browser view.')
      void loadBrowserUrl(record, normalized).then(() => emitBrowserState(hostWindow, record))
      return { action: 'deny' }
    }

    record.state.error = '已阻止不支持的弹窗链接。'
    emitPopupPolicyEvent(electron, hostWindow, record, url, false, 'Popup URL is outside the supported Browser Network navigation policy.')
    emitBrowserState(hostWindow, record)
    return { action: 'deny' }
  })
  webContents.on('will-navigate', (event, url) => {
    if (!normalizeBrowserUrl(url)) event.preventDefault()
  })
  webContents.on('did-start-loading', () => {
    record.state.loading = true
    record.state.error = undefined
    emitBrowserState(hostWindow, record)
  })
  webContents.on('did-stop-loading', () => {
    updateBrowserState(record)
    emitBrowserState(hostWindow, record)
  })
  webContents.on('did-navigate', (_event, url) => {
    record.state.url = url
    updateBrowserState(record)
    emitBrowserState(hostWindow, record)
  })
  webContents.on('did-navigate-in-page', (_event, url) => {
    record.state.url = url
    updateBrowserState(record)
    emitBrowserState(hostWindow, record)
  })
  webContents.on('page-title-updated', (_event, title) => {
    record.state.title = title || 'Browser'
    emitBrowserState(hostWindow, record)
  })
  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return
    record.state.loading = false
    record.state.url = validatedURL || record.state.url
    record.state.error = errorDescription || 'Page failed to load'
    emitBrowserState(hostWindow, record)
  })
  electron.app.on('web-contents-created', (_event, contents) => {
    const currentContents = getWebContents(record)
    if (!currentContents || contents.id !== currentContents.id) return
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
  return undefined
}

export async function loadBrowserUrl(record: BrowserViewRecord, url: string): Promise<void> {
  record.state.url = url
  record.state.error = undefined
  const webContents = getWebContents(record)
  if (!webContents) {
    record.state.loading = false
    record.state.error = 'Browser web contents unavailable'
    return
  }
  try {
    await webContents.loadURL(url)
  } catch (error) {
    if (isNavigationAbortError(error)) {
      record.state.loading = false
      record.state.error = undefined
      return
    }
    record.state.loading = false
    record.state.error = error instanceof Error ? error.message : 'Page failed to load'
  }
}

export function updateBrowserState(record: BrowserViewRecord): BrowserViewState {
  const webContents = getWebContents(record)
  if (!webContents) {
    record.state = {
      ...record.state,
      sessionId: record.sessionId,
      loading: false,
      error: record.state.error ?? 'Browser web contents unavailable',
      canGoBack: false,
      canGoForward: false,
    }
    return record.state
  }

  record.state = {
    ...record.state,
    sessionId: record.sessionId,
    url: webContents.getURL() || record.state.url,
    title: webContents.getTitle() || record.state.title,
    loading: webContents.isLoading(),
    canGoBack: webContents.canGoBack(),
    canGoForward: webContents.canGoForward(),
  }
  return record.state
}

export function emitBrowserState(hostWindow: BrowserHostWindow, record: BrowserViewRecord): void {
  if (hostWindow.isDestroyed()) return
  hostWindow.webContents.send('mediatoolbox:browser:event', {
    type: 'state',
    state: updateBrowserState(record),
  })
}

export function destroyBrowserView(hostWindow: BrowserHostWindow, id: string): void {
  const record = browserViews.get(id)
  if (!record) return
  browserViews.delete(id)
  try {
    hostWindow.contentView.removeChildView(record.view)
  } catch {
    // The host window may already be gone during app shutdown.
  }
  const webContents = getWebContents(record)
  if (webContents && !webContents.isDestroyed()) {
    webContents.close()
  }
}

export function getWebContents(record: BrowserViewRecord): import('electron').WebContents | undefined {
  const webContents = (record.view as { webContents?: import('electron').WebContents }).webContents
  return webContents && !webContents.isDestroyed() ? webContents : undefined
}

export function getRecord(payload: unknown): BrowserViewRecord | undefined {
  const id = getStringField(payload, 'id')
  return id ? browserViews.get(id) : undefined
}

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function fail<T = never>(error: string): IpcResult<T> {
  return { ok: false, error }
}

function emitPopupPolicyEvent(
  electron: ElectronModule,
  hostWindow: BrowserHostWindow,
  record: BrowserViewRecord,
  url: string,
  granted: boolean,
  reason: string,
): void {
  emitPermissionEvent({
    electron,
    hostWindow,
    viewId: record.id,
    apiUrl: record.networkOptions.apiUrl,
    rootDir: record.networkOptions.rootDir,
    env: record.networkOptions.env,
  }, {
    view_id: record.id,
    session_id: record.sessionId,
    origin: url || 'unknown',
    permission: 'openExternal',
    decision: granted ? 'granted' : 'denied',
    reason,
  })
}
