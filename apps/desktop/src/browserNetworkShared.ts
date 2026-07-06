import path from 'node:path'
import type { BrowserNetworkPermissionEvent, BrowserNetworkSessionScope } from '@mediatoolbox/contracts'

type ElectronModule = typeof import('electron')
export type BrowserHostWindow = import('electron').BrowserWindow

export type BrowserNetworkOptions = {
  viewId: string
  sessionScope?: BrowserNetworkSessionScope
  hostWindow: BrowserHostWindow
  electron: ElectronModule
  apiUrl: string
  rootDir: string
  env?: NodeJS.ProcessEnv | undefined
}

export type BrowserNetworkDownloadEvent = {
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

export type BrowserNetworkRequestEvent = {
  id: string
  viewId: string
  sessionId: string
  url: string
  method: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  responseStatus?: number
  responseBytes: number
  error?: string
}

export type BrowserNetworkEvent =
  | { type: 'download'; download: BrowserNetworkDownloadEvent }
  | { type: 'permission'; permission: BrowserNetworkPermissionEvent }
  | { type: 'request'; request: BrowserNetworkRequestEvent }
  | { type: 'upload-selection'; selection: import('@mediatoolbox/contracts').BrowserNetworkUploadSelection }

export function emitBrowserNetworkEvent(hostWindow: BrowserHostWindow, event: BrowserNetworkEvent): void {
  if (hostWindow.isDestroyed()) return
  hostWindow.webContents.send('mediatoolbox:browser:event', event)
}

export function emitPermissionEvent(options: BrowserNetworkOptions, permission: BrowserNetworkPermissionEvent): void {
  emitBrowserNetworkEvent(options.hostWindow, { type: 'permission', permission })
  void postBrowserNetworkJson(options.apiUrl, '/api/browser-network/permission-events', permission).catch(() => undefined)
}

export function resolveWorkspaceDirectory(options: BrowserNetworkOptions): string {
  const env = options.env ?? process.env
  const workspace = env['MEDIATOOLBOX_WORKSPACE_DIR']?.trim()
  if (workspace) return path.resolve(workspace)
  return path.join(options.rootDir, '.tmp', 'workspace')
}

export function resolveDownloadDirectory(options: BrowserNetworkOptions): string {
  const env = options.env ?? process.env
  const explicit = env['MEDIATOOLBOX_BROWSER_DOWNLOAD_DIR']?.trim()
  if (explicit) return path.resolve(explicit)

  const workspace = env['MEDIATOOLBOX_WORKSPACE_DIR']?.trim()
  if (workspace) return path.join(path.resolve(workspace), 'Downloads')

  return path.join(options.rootDir, '.tmp', 'workspace', 'Downloads')
}

export function sanitizeFilename(filename: string): string {
  const basename = path.basename(filename).replace(/[/:\\]/g, '-').trim()
  return basename || 'download.bin'
}

export function safePartitionSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 48) || 'default'
}

export async function postBrowserNetworkJson(apiUrl: string, pathname: string, body: unknown): Promise<void> {
  await sendBrowserNetworkJson(apiUrl, pathname, 'POST', body)
}

export async function patchBrowserNetworkJson(apiUrl: string, pathname: string, body: unknown): Promise<void> {
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
