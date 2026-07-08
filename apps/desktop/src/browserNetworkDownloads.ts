import fs from 'node:fs'
import path from 'node:path'

import {
  emitBrowserNetworkEvent,
  patchBrowserNetworkJson,
  postBrowserNetworkJson,
  resolveDownloadDirectory,
  sanitizeFilename,
  toVirtualWorkspacePath,
  type BrowserNetworkDownloadEvent,
  type BrowserNetworkOptions,
} from './browserNetworkShared.js'

type BrowserSession = import('electron').Session
type DownloadItem = import('electron').DownloadItem

type TrackedDownloadItem = {
  item: DownloadItem
  viewId: string
}

const downloadItems = new Map<string, TrackedDownloadItem>()

export function cancelBrowserNetworkDownload(id: string, viewId?: string): boolean {
  const tracked = downloadItems.get(id)
  if (!tracked || (viewId && tracked.viewId !== viewId) || tracked.item.getState() !== 'progressing') return false
  tracked.item.cancel()
  return true
}

export function configureDownloads(session: BrowserSession, options: BrowserNetworkOptions, sessionId: string): void {
  session.on('will-download', (_event, item, webContents) => {
    const id = `browser-download-${Date.now()}-${downloadItems.size + 1}`
    const filename = sanitizeFilename(item.getFilename())
    const target = createDownloadTarget(options, filename)
    const sourceUrl = item.getURL()
    const urlChain = item.getURLChain()
    const totalBytes = item.getTotalBytes()
    const mimeType = item.getMimeType()

    item.setSavePath(target.physicalPath)
    downloadItems.set(id, { item, viewId: options.viewId })

    const started = {
      id,
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
    void postBrowserNetworkJson(options.apiUrl, '/api/browser-network/downloads', started, options.desktopAuthToken)

    item.on('updated', (_downloadEvent, state) => {
      const status = state === 'interrupted' ? 'failed' : 'running'
      const update = {
        status,
        received_bytes: item.getReceivedBytes(),
        total_bytes: item.getTotalBytes(),
        ...(state === 'interrupted' ? { error: 'Browser download interrupted.' } : {}),
      }
      emitDownloadEvent(options, toDownloadEvent(id, options.viewId, sessionId, item, target.virtualPath, status, update.error))
      void patchBrowserNetworkJson(options.apiUrl, `/api/browser-network/downloads/${encodeURIComponent(id)}`, update, options.desktopAuthToken)
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
      void patchBrowserNetworkJson(options.apiUrl, `/api/browser-network/downloads/${encodeURIComponent(id)}`, update, options.desktopAuthToken)
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

  const physicalPath = path.join(downloadDir, candidate)
  const virtualPath = toVirtualWorkspacePath(options, physicalPath)
  if (!virtualPath?.startsWith('/Workspace/Downloads/')) {
    throw new Error('Browser download target must stay inside the workspace Downloads directory.')
  }

  return {
    filename: candidate,
    physicalPath,
    virtualPath,
  }
}

function emitDownloadEvent(options: BrowserNetworkOptions, download: BrowserNetworkDownloadEvent): void {
  emitBrowserNetworkEvent(options.hostWindow, { type: 'download', download })
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
