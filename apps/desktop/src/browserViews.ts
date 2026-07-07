import { cancelBrowserNetworkDownload, createBrowserNetworkSession, requestBrowserNetworkUrl, selectWorkspaceUploadFile } from './browserNetwork.js'
import {
  getBooleanField,
  getBoundsField,
  getRequestMethodField,
  getSessionScopeField,
  getStringField,
  getStringMapField,
  normalizeBrowserUrl,
} from './browserViewPayload.js'
import {
  assertBrowserSender,
  browserViews,
  configureBrowserView,
  destroyBrowserView,
  emitBrowserState,
  fail,
  getRecord,
  getWebContents,
  loadBrowserUrl,
  ok,
  updateBrowserState,
  type BrowserHostWindow,
  type BrowserViewRecord,
  type BrowserViewState,
  type ElectronModule,
  type IpcResult,
} from './browserViewState.js'
import { requestDirReadGrant, requestFileReadGrant, requestFileWriteGrant } from './pathGrants.js'

export function registerBrowserViewIpcHandlers(
  electron: ElectronModule,
  hostWindow: BrowserHostWindow,
  options: { apiUrl: string; rootDir: string; env?: NodeJS.ProcessEnv },
) {
  electron.ipcMain.handle('mediatoolbox:browser:create', async (event, payload: unknown): Promise<IpcResult<BrowserViewState>> => {
    assertBrowserSender(event, hostWindow)
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
    assertBrowserSender(event, hostWindow)
    const id = getStringField(payload, 'id')
    if (!id) return fail('Missing browser view id')
    destroyBrowserView(hostWindow, id)
    return ok({ id })
  })

  electron.ipcMain.handle('mediatoolbox:browser:set-bounds', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertBrowserSender(event, hostWindow)
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
    assertBrowserSender(event, hostWindow)
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
    assertBrowserSender(event, hostWindow)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    if (webContents.canGoBack()) webContents.goBack()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:go-forward', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertBrowserSender(event, hostWindow)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    if (webContents.canGoForward()) webContents.goForward()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:reload', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertBrowserSender(event, hostWindow)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    webContents.reload()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:focus', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertBrowserSender(event, hostWindow)
    const record = getRecord(payload)
    if (!record) return fail('Browser view not found')
    hostWindow.contentView.addChildView(record.view)
    const webContents = getWebContents(record)
    if (!webContents) return fail('Browser web contents unavailable')
    webContents.focus()
    return ok(updateBrowserState(record))
  })

  electron.ipcMain.handle('mediatoolbox:browser:download-url', (event, payload: unknown): IpcResult<BrowserViewState> => {
    assertBrowserSender(event, hostWindow)
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
    assertBrowserSender(event, hostWindow)
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
    assertBrowserSender(event, hostWindow)
    const id = getStringField(payload, 'downloadId')
    if (!id) return fail('Missing browser download id')
    return ok({ id, canceled: cancelBrowserNetworkDownload(id) })
  })

  electron.ipcMain.handle('mediatoolbox:browser:select-upload-file', async (event, payload: unknown) => {
    assertBrowserSender(event, hostWindow)
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

  electron.ipcMain.handle('mediatoolbox:path-grant:request-read', async (event) => {
    assertBrowserSender(event, hostWindow)
    const grant = await requestFileReadGrant({ electron, hostWindow, apiUrl: options.apiUrl })
    return ok(grant ?? null)
  })

  electron.ipcMain.handle('mediatoolbox:path-grant:request-write', async (event, payload: unknown) => {
    assertBrowserSender(event, hostWindow)
    const defaultPath =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).defaultPath as string | undefined
        : undefined
    const grant = await requestFileWriteGrant({
      electron,
      hostWindow,
      apiUrl: options.apiUrl,
      ...(defaultPath !== undefined ? { defaultPath } : {}),
    })
    return ok(grant ?? null)
  })

  electron.ipcMain.handle('mediatoolbox:path-grant:request-dir-read', async (event) => {
    assertBrowserSender(event, hostWindow)
    const grant = await requestDirReadGrant({ electron, hostWindow, apiUrl: options.apiUrl })
    return ok(grant ?? null)
  })

  hostWindow.on('closed', () => {
    for (const id of [...browserViews.keys()]) destroyBrowserView(hostWindow, id)
  })
}
