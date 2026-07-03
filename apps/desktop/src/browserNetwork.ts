import fs from 'node:fs'
import path from 'node:path'
import type { BrowserNetworkPermissionEvent } from '@mediatoolbox/contracts'

type ElectronModule = typeof import('electron')
type BrowserHostWindow = import('electron').BrowserWindow
type BrowserSession = import('electron').Session
type DownloadItem = import('electron').DownloadItem

type BrowserNetworkOptions = {
  viewId: string
  hostWindow: BrowserHostWindow
  electron: ElectronModule
  apiUrl: string
  rootDir: string
  env?: NodeJS.ProcessEnv | undefined
}

type BrowserNetworkDownloadEvent = {
  id: string
  viewId: string
  sessionId: string
  sourceUrl: string
  filename: string
  targetPath: string
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  receivedBytes: number
  totalBytes: number
  error?: string
}

type BrowserNetworkEvent =
  | { type: 'download'; download: BrowserNetworkDownloadEvent }
  | { type: 'permission'; permission: BrowserNetworkPermissionEvent }

const configuredSessions = new Set<string>()
const downloadItems = new Map<string, DownloadItem>()

export function createBrowserNetworkSession(options: BrowserNetworkOptions): { session: BrowserSession; sessionId: string } {
  const sessionId = `mediatoolbox-browser-${safePartitionSegment(options.viewId)}`
  const partition = `persist:${sessionId}`
  const session = options.electron.session.fromPartition(partition)

  if (!configuredSessions.has(partition)) {
    configuredSessions.add(partition)
    configurePermissions(session, options, sessionId)
    configureDownloads(session, options, sessionId)
  }

  return { session, sessionId }
}

export function cancelBrowserNetworkDownload(id: string): boolean {
  const item = downloadItems.get(id)
  if (!item || item.getState() !== 'progressing') return false
  item.cancel()
  return true
}

function configurePermissions(session: BrowserSession, options: BrowserNetworkOptions, sessionId: string): void {
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const granted = permission === 'fullscreen'
    emitPermissionEvent(options, sessionId, {
      view_id: options.viewId,
      session_id: sessionId,
      origin: requestingOrigin || 'unknown',
      permission: normalizePermission(permission),
      decision: granted ? 'granted' : 'denied',
      reason: granted ? 'Fullscreen is allowed for browser usability.' : 'Permission requires an explicit Browser Network policy.',
    })
    return granted
  })

  session.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const granted = permission === 'fullscreen'
    const origin = 'requestingUrl' in details && typeof details.requestingUrl === 'string'
      ? details.requestingUrl
      : 'unknown'
    emitPermissionEvent(options, sessionId, {
      view_id: options.viewId,
      session_id: sessionId,
      origin,
      permission: normalizePermission(permission),
      decision: granted ? 'granted' : 'denied',
      reason: granted ? 'Fullscreen is allowed for browser usability.' : 'Permission denied by default Browser Network policy.',
    })
    callback(granted)
  })

  session.on('file-system-access-restricted', (_event, details, callback) => {
    emitPermissionEvent(options, sessionId, {
      view_id: options.viewId,
      session_id: sessionId,
      origin: details.origin,
      permission: 'fileSystem',
      decision: 'denied',
      reason: 'Workspace upload bridge requires explicit user confirmation and is not auto-granted.',
    })
    callback('deny')
  })
}

function configureDownloads(session: BrowserSession, options: BrowserNetworkOptions, sessionId: string): void {
  session.on('will-download', (_event, item, webContents) => {
    const id = `browser-download-${Date.now()}-${downloadItems.size + 1}`
    const filename = sanitizeFilename(item.getFilename())
    const target = createDownloadTarget(options, filename)
    const sourceUrl = item.getURL()
    const urlChain = item.getURLChain()
    const totalBytes = item.getTotalBytes()
    const mimeType = item.getMimeType()

    item.setSavePath(target.physicalPath)
    downloadItems.set(id, item)

    const started = {
      source_url: sourceUrl,
      url_chain: urlChain.length ? urlChain : [sourceUrl],
      filename: target.filename,
      target_path: target.virtualPath,
      view_id: options.viewId,
      session_id: sessionId,
      total_bytes: totalBytes,
      mime_type: mimeType,
      user_gesture: item.hasUserGesture(),
    }

    emitDownloadEvent(options, toDownloadEvent(id, options.viewId, sessionId, item, target.virtualPath, 'running'))
    void postBrowserNetworkJson(options.apiUrl, '/api/browser-network/downloads', started)

    item.on('updated', (_downloadEvent, state) => {
      const status = state === 'interrupted' ? 'failed' : 'running'
      const update = {
        status,
        received_bytes: item.getReceivedBytes(),
        total_bytes: item.getTotalBytes(),
        ...(state === 'interrupted' ? { error: 'Browser download interrupted.' } : {}),
      }
      emitDownloadEvent(options, toDownloadEvent(id, options.viewId, sessionId, item, target.virtualPath, status, update.error))
      void patchBrowserNetworkJson(options.apiUrl, `/api/browser-network/downloads/${encodeURIComponent(id)}`, update)
    })

    item.once('done', (_downloadEvent, state) => {
      downloadItems.delete(id)
      const status = state === 'completed' ? 'succeeded' : state === 'cancelled' ? 'canceled' : 'failed'
      const error = status === 'failed' ? 'Browser download interrupted.' : undefined
      const update = {
        status,
        received_bytes: item.getReceivedBytes(),
        total_bytes: item.getTotalBytes(),
        ...(error ? { error } : {}),
      }
      emitDownloadEvent(options, toDownloadEvent(id, options.viewId, sessionId, item, target.virtualPath, status, error))
      void patchBrowserNetworkJson(options.apiUrl, `/api/browser-network/downloads/${encodeURIComponent(id)}`, update)
    })

    if (webContents.id !== options.hostWindow.webContents.id) {
      webContents.once('destroyed', () => downloadItems.delete(id))
    }
  })
}

function createDownloadTarget(options: BrowserNetworkOptions, filename: string): { filename: string; physicalPath: string; virtualPath: string } {
  const downloadDir = resolveDownloadDirectory(options)
  fs.mkdirSync(downloadDir, { recursive: true })

  const parsed = path.parse(filename)
  let candidate = filename
  let counter = 1
  while (fs.existsSync(path.join(downloadDir, candidate))) {
    candidate = `${parsed.name || 'download'}-${counter}${parsed.ext}`
    counter += 1
  }

  return {
    filename: candidate,
    physicalPath: path.join(downloadDir, candidate),
    virtualPath: `/Workspace/Downloads/${candidate}`,
  }
}

function resolveDownloadDirectory(options: BrowserNetworkOptions): string {
  const env = options.env ?? process.env
  const explicit = env['MEDIATOOLBOX_BROWSER_DOWNLOAD_DIR']?.trim()
  if (explicit) return path.resolve(explicit)

  const workspace = env['MEDIATOOLBOX_WORKSPACE_DIR']?.trim()
  if (workspace) return path.join(path.resolve(workspace), 'Downloads')

  return path.join(options.rootDir, '.tmp', 'workspace', 'Downloads')
}

function emitDownloadEvent(options: BrowserNetworkOptions, download: BrowserNetworkDownloadEvent): void {
  emitBrowserNetworkEvent(options.hostWindow, { type: 'download', download })
}

function emitPermissionEvent(options: BrowserNetworkOptions, sessionId: string, permission: BrowserNetworkPermissionEvent): void {
  emitBrowserNetworkEvent(options.hostWindow, { type: 'permission', permission })
  void postBrowserNetworkJson(options.apiUrl, '/api/browser-network/permission-events', permission).catch(() => undefined)
}

function emitBrowserNetworkEvent(hostWindow: BrowserHostWindow, event: BrowserNetworkEvent): void {
  if (hostWindow.isDestroyed()) return
  hostWindow.webContents.send('mediatoolbox:browser:event', event)
}

function toDownloadEvent(
  id: string,
  viewId: string,
  sessionId: string,
  item: DownloadItem,
  targetPath: string,
  status: BrowserNetworkDownloadEvent['status'],
  error?: string,
): BrowserNetworkDownloadEvent {
  return {
    id,
    viewId,
    sessionId,
    sourceUrl: item.getURL(),
    filename: item.getFilename(),
    targetPath,
    status,
    receivedBytes: item.getReceivedBytes(),
    totalBytes: item.getTotalBytes(),
    ...(error ? { error } : {}),
  }
}

function sanitizeFilename(filename: string): string {
  const basename = path.basename(filename).replace(/[/:\\]/g, '-').trim()
  return basename || 'download.bin'
}

function safePartitionSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 48) || 'default'
}

function normalizePermission(permission: string): BrowserNetworkPermissionEvent['permission'] {
  const known = new Set([
    'clipboard-read',
    'clipboard-sanitized-write',
    'display-capture',
    'fullscreen',
    'geolocation',
    'media',
    'notifications',
    'openExternal',
    'storage-access',
    'top-level-storage-access',
    'fileSystem',
  ])
  return known.has(permission) ? permission as BrowserNetworkPermissionEvent['permission'] : 'unknown'
}

async function postBrowserNetworkJson(apiUrl: string, pathname: string, body: unknown): Promise<void> {
  await sendBrowserNetworkJson(apiUrl, pathname, 'POST', body)
}

async function patchBrowserNetworkJson(apiUrl: string, pathname: string, body: unknown): Promise<void> {
  await sendBrowserNetworkJson(apiUrl, pathname, 'PATCH', body)
}

async function sendBrowserNetworkJson(apiUrl: string, pathname: string, method: 'POST' | 'PATCH', body: unknown): Promise<void> {
  const response = await fetch(new URL(pathname, apiUrl), {
    method,
    headers: {
      'content-type': 'application/json',
      'x-mediatoolbox-browser-network': 'desktop',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Browser Network API ${method} ${pathname} failed with ${response.status}.`)
}
