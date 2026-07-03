import type { IpcMainInvokeEvent, Rectangle } from 'electron'

type ElectronModule = typeof import('electron')
type BrowserHostWindow = import('electron').BrowserWindow
type BrowserWebContentsView = import('electron').WebContentsView

type BrowserViewState = {
  id: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: string | undefined
}

type BrowserViewRecord = {
  id: string
  view: BrowserWebContentsView
  state: BrowserViewState
}

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

const browserViews = new Map<string, BrowserViewRecord>()

export function registerBrowserViewIpcHandlers(electron: ElectronModule, hostWindow: BrowserHostWindow) {
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

    const view = new electron.WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    const record: BrowserViewRecord = {
      id,
      view,
      state: {
        id,
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
    configureBrowserView(electron, hostWindow, record)
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
    if (record.view.webContents.canGoBack()) record.view.webContents.goBack()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:go-forward', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    if (record.view.webContents.canGoForward()) record.view.webContents.goForward()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:reload', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    record.view.webContents.reload()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:focus', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertSender(event)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    hostWindow.contentView.addChildView(record.view)
    record.view.webContents.focus()
    return ok(updateBrowserState(record))
  })

  hostWindow.on('closed', () => {
    for (const id of [...browserViews.keys()]) destroyBrowserView(hostWindow, id)
  })
}

function configureBrowserView(electron: ElectronModule, hostWindow: BrowserHostWindow, record: BrowserViewRecord) {
  const { view } = record
  view.webContents.setWindowOpenHandler(({ url }) => {
    const normalized = normalizeBrowserUrl(url)
    if (normalized) void loadBrowserUrl(record, normalized)
    return { action: 'deny' }
  })
  view.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  view.webContents.on('will-navigate', (event, url) => {
    if (!normalizeBrowserUrl(url)) event.preventDefault()
  })
  view.webContents.on('did-start-loading', () => {
    record.state.loading = true
    record.state.error = undefined
    emitBrowserState(hostWindow, record)
  })
  view.webContents.on('did-stop-loading', () => {
    updateBrowserState(record)
    emitBrowserState(hostWindow, record)
  })
  view.webContents.on('did-navigate', (_event, url) => {
    record.state.url = url
    updateBrowserState(record)
    emitBrowserState(hostWindow, record)
  })
  view.webContents.on('did-navigate-in-page', (_event, url) => {
    record.state.url = url
    updateBrowserState(record)
    emitBrowserState(hostWindow, record)
  })
  view.webContents.on('page-title-updated', (_event, title) => {
    record.state.title = title || 'Browser'
    emitBrowserState(hostWindow, record)
  })
  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return
    record.state.loading = false
    record.state.url = validatedURL || record.state.url
    record.state.error = errorDescription || 'Page failed to load'
    emitBrowserState(hostWindow, record)
  })
  electron.app.on('web-contents-created', (_event, contents) => {
    if (contents.id !== view.webContents.id) return
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}

async function loadBrowserUrl(record: BrowserViewRecord, url: string) {
  record.state.url = url
  record.state.error = undefined
  try {
    await record.view.webContents.loadURL(url)
  } catch (error) {
    record.state.loading = false
    record.state.error = error instanceof Error ? error.message : 'Page failed to load'
  }
}

function updateBrowserState(record: BrowserViewRecord): BrowserViewState {
  record.state = {
    ...record.state,
    url: record.view.webContents.getURL() || record.state.url,
    title: record.view.webContents.getTitle() || record.state.title,
    loading: record.view.webContents.isLoading(),
    canGoBack: record.view.webContents.canGoBack(),
    canGoForward: record.view.webContents.canGoForward(),
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
  if (!record.view.webContents.isDestroyed()) {
    record.view.webContents.close()
  }
}

function getRecord(payload: unknown) {
  const id = getStringField(payload, 'id')
  return id ? browserViews.get(id) : undefined
}

function normalizeBrowserUrl(raw: string): string | null {
  let input = raw.trim()
  if (!input) return null
  if (input === 'about:blank') return input

  const scheme = input.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https') return null
  if (!input.includes('://')) {
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

function getStringField(payload: unknown, field: string): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

function getBooleanField(payload: unknown, field: string): boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>)[field]
  return typeof value === 'boolean' ? value : undefined
}

function getBoundsField(payload: unknown): Rectangle | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>).bounds
  if (!value || typeof value !== 'object') return undefined
  const bounds = value as Record<string, unknown>
  const x = getFiniteNumber(bounds.x)
  const y = getFiniteNumber(bounds.y)
  const width = getFiniteNumber(bounds.width)
  const height = getFiniteNumber(bounds.height)
  if (x === undefined || y === undefined || width === undefined || height === undefined) return undefined
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  }
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail<T = never>(error: string): IpcResult<T> {
  return { ok: false, error }
}
