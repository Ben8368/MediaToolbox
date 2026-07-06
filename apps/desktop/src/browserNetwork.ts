import fs from 'node:fs'
import path from 'node:path'
import type { BrowserNetworkPermissionEvent, BrowserNetworkUploadSelection } from '@mediatoolbox/contracts'

import { cancelBrowserNetworkDownload, configureDownloads } from './browserNetworkDownloads.js'
import { requestBrowserNetworkUrl } from './browserNetworkRequests.js'
import {
  emitBrowserNetworkEvent,
  emitPermissionEvent,
  resolveWorkspaceDirectory,
  safePartitionSegment,
  type BrowserNetworkOptions,
} from './browserNetworkShared.js'

type BrowserSession = import('electron').Session

const configuredSessions = new Set<string>()

export { cancelBrowserNetworkDownload, requestBrowserNetworkUrl }

export function createBrowserNetworkSession(options: BrowserNetworkOptions): { session: BrowserSession; sessionId: string } {
  const sessionId = options.sessionScope === 'default'
    ? 'mediatoolbox-browser-default'
    : `mediatoolbox-browser-${safePartitionSegment(options.viewId)}`
  const partition = `persist:${sessionId}`
  const session = options.electron.session.fromPartition(partition)

  if (!configuredSessions.has(partition)) {
    configuredSessions.add(partition)
    configurePermissions(session, options, sessionId)
    configureDownloads(session, options, sessionId)
  }

  return { session, sessionId }
}

export async function selectWorkspaceUploadFile(options: BrowserNetworkOptions, sessionId: string): Promise<BrowserNetworkUploadSelection | undefined> {
  const workspaceRoot = resolveWorkspaceDirectory(options)
  const result = await options.electron.dialog.showOpenDialog(options.hostWindow, {
    title: '选择要上传的工作区文件',
    defaultPath: workspaceRoot,
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) {
    emitPermissionEvent(options, {
      view_id: options.viewId,
      session_id: sessionId,
      origin: 'workspace-upload-bridge',
      permission: 'fileSystem',
      decision: 'denied',
      reason: 'User canceled workspace upload file selection.',
    })
    return undefined
  }

  const physicalPath = path.resolve(result.filePaths[0])
  const workspace = path.resolve(workspaceRoot)
  if (physicalPath !== workspace && !physicalPath.startsWith(`${workspace}${path.sep}`)) {
    emitPermissionEvent(options, {
      view_id: options.viewId,
      session_id: sessionId,
      origin: 'workspace-upload-bridge',
      permission: 'fileSystem',
      decision: 'denied',
      reason: 'Selected file is outside the configured workspace.',
    })
    return undefined
  }

  const stat = fs.statSync(physicalPath)
  if (!stat.isFile()) return undefined
  const filename = path.basename(physicalPath)
  const virtualPath = `/Workspace/${path.relative(workspace, physicalPath).split(path.sep).join('/')}`
  const confirmed = await options.electron.dialog.showMessageBox(options.hostWindow, {
    type: 'question',
    buttons: ['允许上传', '取消'],
    defaultId: 0,
    cancelId: 1,
    title: '确认上传工作区文件',
    message: `允许当前浏览器页面使用工作区文件“${filename}”？`,
    detail: virtualPath,
  })
  const selection: BrowserNetworkUploadSelection = {
    view_id: options.viewId,
    session_id: sessionId,
    filename,
    path: virtualPath,
    size: stat.size,
    confirmed: confirmed.response === 0,
  }

  emitPermissionEvent(options, {
    view_id: options.viewId,
    session_id: sessionId,
    origin: 'workspace-upload-bridge',
    permission: 'fileSystem',
    decision: selection.confirmed ? 'granted' : 'denied',
    reason: selection.confirmed ? `Workspace file selected: ${virtualPath}` : 'User rejected workspace upload confirmation.',
  })
  emitBrowserNetworkEvent(options.hostWindow, { type: 'upload-selection', selection })
  return selection.confirmed ? selection : undefined
}

function configurePermissions(session: BrowserSession, options: BrowserNetworkOptions, sessionId: string): void {
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const granted = permission === 'fullscreen'
    emitPermissionEvent(options, {
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
    emitPermissionEvent(options, {
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
    emitPermissionEvent(options, {
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
