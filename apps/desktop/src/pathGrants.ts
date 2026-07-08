import path from 'node:path'
import type { BrowserWindow } from 'electron'

type ElectronModule = typeof import('electron')

// Grant info 类型（与 contracts 对齐，这里内联避免循环依赖）
type PathGrantInfo = {
  id: string
  kind: 'file.read' | 'file.write' | 'dir.read'
  status: string
  displayName: string
  expiresAt: number
  createdAt: number
  updatedAt: number
  jobId?: string
}

async function postPathGrant(
  apiUrl: string,
  desktopAuthToken: string,
  payload: { kind: string; physicalPath: string; displayName: string },
): Promise<PathGrantInfo | undefined> {
  try {
    const res = await fetch(`${apiUrl}/api/path-grants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mediatoolbox-desktop': 'desktop',
        'x-mediatoolbox-desktop-token': desktopAuthToken,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return undefined
    const data = (await res.json()) as { ok: boolean; grant?: PathGrantInfo }
    return data.ok ? data.grant : undefined
  } catch {
    return undefined
  }
}

export async function requestFileReadGrant(options: {
  electron: ElectronModule
  hostWindow: BrowserWindow
  apiUrl: string
  desktopAuthToken: string
}): Promise<PathGrantInfo | undefined> {
  const { electron, hostWindow, apiUrl, desktopAuthToken } = options
  const result = await electron.dialog.showOpenDialog(hostWindow, {
    title: '选择外部文件（只读授权）',
    properties: ['openFile'],
  })
  const physicalPath = result.filePaths[0]
  if (result.canceled || !physicalPath) return undefined

  const displayName = path.basename(physicalPath)

  const confirm = await electron.dialog.showMessageBox(hostWindow, {
    type: 'question',
    title: '授权只读访问',
    message: `允许读取工作区外文件？\n\n${physicalPath}`,
    buttons: ['允许', '取消'],
    defaultId: 0,
    cancelId: 1,
  })
  if (confirm.response !== 0) return undefined

  return postPathGrant(apiUrl, desktopAuthToken, { kind: 'file.read', physicalPath, displayName })
}

export async function requestFileWriteGrant(options: {
  electron: ElectronModule
  hostWindow: BrowserWindow
  apiUrl: string
  defaultPath?: string
  desktopAuthToken: string
}): Promise<PathGrantInfo | undefined> {
  const { electron, hostWindow, apiUrl, defaultPath, desktopAuthToken } = options
  const result = await electron.dialog.showSaveDialog(hostWindow, {
    title: '选择导出路径（工作区外写入授权）',
    ...(defaultPath ? { defaultPath } : {}),
  })
  if (result.canceled || !result.filePath) return undefined

  const physicalPath = result.filePath
  const displayName = path.basename(physicalPath)

  const confirm = await electron.dialog.showMessageBox(hostWindow, {
    type: 'warning',
    title: '写入工作区外',
    message: `即将写入工作区外路径，请确认：\n\n${physicalPath}`,
    buttons: ['确认写入', '取消'],
    defaultId: 0,
    cancelId: 1,
  })
  if (confirm.response !== 0) return undefined

  return postPathGrant(apiUrl, desktopAuthToken, { kind: 'file.write', physicalPath, displayName })
}

export async function requestDirReadGrant(options: {
  electron: ElectronModule
  hostWindow: BrowserWindow
  apiUrl: string
  desktopAuthToken: string
}): Promise<PathGrantInfo | undefined> {
  const { electron, hostWindow, apiUrl, desktopAuthToken } = options
  const result = await electron.dialog.showOpenDialog(hostWindow, {
    title: '选择外部目录（只读授权）',
    properties: ['openDirectory'],
  })
  const physicalPath = result.filePaths[0]
  if (result.canceled || !physicalPath) return undefined

  const displayName = path.basename(physicalPath) || physicalPath

  const confirm = await electron.dialog.showMessageBox(hostWindow, {
    type: 'question',
    title: '授权目录只读访问',
    message: `允许浏览工作区外目录？\n\n${physicalPath}`,
    buttons: ['允许', '取消'],
    defaultId: 0,
    cancelId: 1,
  })
  if (confirm.response !== 0) return undefined

  return postPathGrant(apiUrl, desktopAuthToken, { kind: 'dir.read', physicalPath, displayName })
}
