import type { IpcMainInvokeEvent } from 'electron'
import { cancelBrowserNetworkDownload, createBrowserNetworkSession, requestBrowserNetworkUrl, selectWorkspaceUploadFile } from './browserNetwork.js'
import {
  getBooleanField,
  getBoundsField,
  getRequestMethodField,
  getSessionScopeField,
  getStringField,
  getStringMapField,
  isNavigationAbortError,
  normalizeBrowserUrl,
} from './browserViewPayload.js'

type ElectronModule = typeof import('electron')
type BrowserHostWindow = import('electron').BrowserWindow
type BrowserWebContentsView = import('electron').WebContentsView

type BrowserViewState = {
  id: string
  sessionId: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: string | undefined
}

type BrowserViewRecord = {
  id: string
  sessionId: string
  networkOptions: { apiUrl: string; rootDir: string; env?: NodeJS.ProcessEnv }
  view: BrowserWebContentsView
  state: BrowserViewState
}

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

const browserViews = new Map<string, BrowserViewRecord>()

export function registerBrowserViewIpcHandlers(
  electron: ElectronModule,
  hostWindow: BrowserHostWindow,
  options: { apiUrl: string; rootDir: string; env?: NodeJS.ProcessEnv },
) {
  const assertSender = (event: IpcMainInvokeEvent) => {
    if (event.sender.id !== hostWindow.webContents.id) {
      throw new Error('Browser IPC rejected from unknown sender')
    }
  }

  electron.ipcMain.handle('mediatoolbox:browser:create', async (event, payload: unknown): Promise<IpcResult<BrowserViewState>> => {
    assertSender(event)
    const id = getStringField(payload, 'id')
    if (!id) return fail('Missing browser view id')

    const existing = browserViews.get(id)
    if (existing) return ok(existing.state)

    const initialUrl = normalizeBrowserUrl(getStringField(payload, 'url') || 'about:blank')
    if (!initialUrl) return fail('Unsupported browser URL')
    const browserNetworkOptions = {
      electron,
      hostWindow,
      viewId: id,
      apiUrl: options.apiUrl,
      rootDir: options.rootDir,
    }
    const browserNetworkOptionsWithEnv = options.env ? { ...browserNetworkOptions, env: options.env } : browserNetworkOptions
    const sessionScope = getSessionScopeField(payload)
    const browserNetwork = createBrowserNetworkSession(sessionScope ? { ...browserNetworkOptionsWithEnv, sessionScope } : browserNetworkOptionsWithEnv)

    const view = new electron.WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        session: browserNetwork.session,
      },
    })
    const record: BrowserViewRecord = {
      id,
      sessionId: browserNetwork.sessionId,
      networkOptions: options,
      view,
      state: {
        id,
        sessionId: browserNetwork.sessionId,
        url: initialUrl,
        title: 'Browser',
        loading: false,
        canGoBack: false,
        canGoForward: false,
        error: undefined,
      },
    }

    browserViews.set(id, record)
    hostWindow.contentView.addChildView(view)
    view.setVisible(false)
    const configureError = configureBrowserView(electron, hostWindow, record)
    if (configureError) {
      destroyBrowserView(hostWindow, id)
      return fail(configureError)
    }
    await loadBrowserUrl(record, initialUrl)
    emitBrowserState(hostWindow, record)
    return ok(record.state)
  })

  electron.ipcMain.handle('mediatoolbox:browser:destroy', (event, payload: unknown): IpcResult<{ id: string }> => {
    assertSender(event)
    const id = getStringField(payload, 'id')
    if (!id) return fail('Missing browser view id')
    destroyBrowserView(hostWindow, id)
    return ok({ id })
  })

  electron.ipcMain.handle('mediatoolbox:browser:set-bounds', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const id = getStringField(payload, 'id')
    const bounds = getBoundsField(payload)
    const visible = getBooleanField(payload, 'visible')
    const record = id ? browserViews.get(id) : undefined
    if (!record) return fail('Browser view not found')
    if (!bounds) return fail('Invalid browser view bounds')

    record.view.setBounds(bounds)
    record.view.setVisible(Boolean(visible && bounds.width > 0 && bounds.height > 0))
    if (visible) hostWindow.contentView.addChildView(record.view)
    return ok(record.state)
  })

  electron.ipcMain.handle('mediatoolbox:browser:navigate', async (event, payload: unknown): Promise<IpcResult<BrowserViewState>> => {
    assertSender(event)
    const id = getStringField(payload, 'id')
    const record = id ? browserViews.get(id) : undefined
    if (!record) return fail('Browser view not found')

    const url = normalizeBrowserUrl(getStringField(payload, 'url') || '')
    if (!url) return fail('Only http, https, and about:blank URLs are supported')

    await loadBrowserUrl(record, url)
    emitBrowserState(hostWindow, record)
    return ok(record.state)
  })

  electron.ipcMain.handle('mediatoolbox:browser:go-back', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    if (webContents.canGoBack()) webContents.goBack()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:go-forward', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    if (webContents.canGoForward()) webContents.goForward()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:reload', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    webContents.reload()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:focus', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    hostWindow.contentView.addChildView(record.view)
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    webContents.focus()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:download-url', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    const explicitUrl = getStringField(payload, 'url')
    const url = normalizeBrowserUrl(explicitUrl || webContents.getURL())
    if (!url || url === 'about:blank') return fail('Only http and https URLs can be downloaded')
    webContents.downloadURL(url)
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:request', async (event, payload: unknown) => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    const url = normalizeBrowserUrl(getStringField(payload, 'url') || '')
    if (!url || url === 'about:blank') return fail('Only http and https URLs are supported')
    try {
      const requestDraft: { url: string; headers?: Record<string, string>; body?: string } = { url }
      const headers = getStringMapField(payload, 'headers')
      const body = getStringField(payload, 'body')
      if (headers) requestDraft.headers = headers
      if (body !== undefined) requestDraft.body = body
      const method = getRequestMethodField(payload)
      const result = await requestBrowserNetworkUrl({
        electron,
        hostWindow,
        viewId: record.id,
        apiUrl: record.networkOptions.apiUrl,
        rootDir: record.networkOptions.rootDir,
        env: record.networkOptions.env,
      }, webContents.session, record.sessionId, method ? { ...requestDraft, method } : requestDraft)
      return ok(result)
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Browser Network request failed')
    }
  })

  electron.ipcMain.handle('mediatoolbox:browser:cancel-download', (event, payload: unknown): IpcResult<{ id: string; canceled: boolean }> => {
    assertSender(event)
    const id = getStringField(payload, 'downloadId')
    if (!id) return fail('Missing browser download id')
    return ok({ id, canceled: cancelBrowserNetworkDownload(id) })
  })

  electron.ipcMain.handle('mediatoolbox:browser:select-upload-file', async (event, payload: unknown) => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const selection = await selectWorkspaceUploadFile({
      electron,
      hostWindow,
      viewId: record.id,
      apiUrl: record.networkOptions.apiUrl,
      rootDir: record.networkOptions.rootDir,
      env: record.networkOptions.env,
    }, record.sessionId)
    return ok(selection ?? null)
  })

  hostWindow.on('closed', () => {
    for (const id of [...browserViews.keys()]) destroyBrowserView(hostWindow, id)
  })
}

function configureBrowserView(electron: ElectronModule, hostWindow: BrowserHostWindow, record: BrowserViewRecord): string | undefined {
  const webContents = getWebContents(record)
  if (!webContents) return 'Browser web contents unavailable'

  webContents.setWindowOpenHandler(({ url }) => {
    const normalized = normalizeBrowserUrl(url)
    if (normalized) void loadBrowserUrl(record, normalized)
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

async function loadBrowserUrl(record: BrowserViewRecord, url: string) {
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

function updateBrowserState(record: BrowserViewRecord): BrowserViewState {
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

function emitBrowserState(hostWindow: BrowserHostWindow, record: BrowserViewRecord) {
  if (hostWindow.isDestroyed()) return
  hostWindow.webContents.send('mediatoolbox:browser:event', {
    type: 'state',
    state: updateBrowserState(record),
  })
}

function destroyBrowserView(hostWindow: BrowserHostWindow, id: string) {
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

function getWebContents(record: BrowserViewRecord): import('electron').WebContents | undefined {
  const webContents = (record.view as { webContents?: import('electron').WebContents }).webContents
  return webContents && !webContents.isDestroyed() ? webContents : undefined
}

function getRecord(payload: unknown) {
  const id = getStringField(payload, 'id')
  return id ? browserViews.get(id) : undefined
}

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail<T = never>(error: string): IpcResult<T> {
  return { ok: false, error }
}
