import { addLog } from './logs'
import { delay, isoOffset, normalizePath, parentPath, entryFromPath, randomId } from './shared'

type MockFile = {
  name: string
  path: string
  size: number
  extension: string
  type: 'file'
}

type TrashSnapshot = {
  folders: string[]
  files: MockFile[]
}

type MockTrashItem = {
  id: string
  name: string
  original_path: string
  deleted_at: string
  type: 'directory' | 'file'
  size: number
  stored_path: string
  snapshot: TrashSnapshot
}

const PROTECTED_PATHS = new Set(['/Workspace'])

const mockFolders = new Set([
  '/Workspace',
  '/Workspace/Downloads',
  '/Workspace/PSD',
  '/Workspace/Exports',
  '/Workspace/Transcodes',
])

const mockFiles: MockFile[] = [
  { name: 'demo-video.mp4', path: '/Workspace/Downloads/demo-video.mp4', size: 248_500_000, extension: 'mp4', type: 'file' },
  { name: 'sample.psd', path: '/Workspace/PSD/sample.psd', size: 86_000_000, extension: 'psd', type: 'file' },
  { name: 'output-preview.png', path: '/Workspace/Exports/output-preview.png', size: 3_200_000, extension: 'png', type: 'file' },
  { name: 'subtitle.srt', path: '/Workspace/Transcodes/subtitle.srt', size: 42_000, extension: 'srt', type: 'file' },
]

const mockTrash: MockTrashItem[] = []

function isUnderOrEqual(path: string, ancestor: string) {
  const normalized = normalizePath(path)
  const root = normalizePath(ancestor)
  return normalized === root || normalized.startsWith(`${root}/`)
}

function trashEntrySize(snapshot: TrashSnapshot) {
  return snapshot.files.reduce((sum, file) => sum + file.size, 0)
}

function removePathFromMock(path: string): TrashSnapshot | null {
  const normalized = normalizePath(path)
  if (PROTECTED_PATHS.has(normalized)) return null

  const fileIndex = mockFiles.findIndex((file) => file.path === normalized)
  if (fileIndex >= 0) {
    return { folders: [], files: [mockFiles.splice(fileIndex, 1)[0]] }
  }

  if (!mockFolders.has(normalized)) return null

  const folders = Array.from(mockFolders)
    .filter((folder) => isUnderOrEqual(folder, normalized))
    .sort((a, b) => a.length - b.length)
  const files = mockFiles.filter((file) => isUnderOrEqual(file.path, normalized))

  for (const folder of folders) mockFolders.delete(folder)
  for (let index = mockFiles.length - 1; index >= 0; index -= 1) {
    if (isUnderOrEqual(mockFiles[index].path, normalized)) mockFiles.splice(index, 1)
  }

  return { folders, files: files.map((file) => ({ ...file })) }
}

function restoreSnapshot(snapshot: TrashSnapshot) {
  for (const folder of snapshot.folders) mockFolders.add(folder)
  for (const file of snapshot.files) {
    if (!mockFiles.some((item) => item.path === file.path)) mockFiles.push({ ...file })
  }
}

function toTrashResponse(item: MockTrashItem) {
  return {
    id: item.id,
    name: item.name,
    original_path: item.original_path,
    deleted_at: item.deleted_at,
    type: item.type,
    size: item.size,
    stored_path: item.stored_path,
  }
}

export async function getWorkspace() {
  await delay(80)
  return {
    ok: true,
    project_root: '/Workspace',
    workspace: {
      project_root: '/Workspace',
      downloads: '/Workspace/Downloads',
      exports: '/Workspace/Exports',
    },
  }
}

export async function fetchFilebrowserDisks() {
  await delay(100)
  return {
    ok: true,
    disks: [
      { name: 'Workspace', path: '/Workspace', total: 512_000_000_000, used: 128_000_000_000, free: 384_000_000_000 },
      { name: 'Downloads', path: '/Workspace/Downloads', total: 256_000_000_000, used: 72_000_000_000, free: 184_000_000_000 },
    ],
  }
}

export async function listFilebrowserDirectory(payload: { directory: string }) {
  await delay(160)
  const directory = normalizePath(payload.directory || '/Workspace')
  const directFolders = Array.from(mockFolders)
    .filter((path) => parentPath(path) === directory)
    .map((path) => entryFromPath(path, 'directory'))
  const directFiles = mockFiles
    .filter((file) => parentPath(file.path) === directory)
    .map((file) => ({ ...file, modified: isoOffset(18) }))
  return {
    ok: true,
    path: mockFolders.has(directory) ? directory : '/Workspace',
    directories: directFolders,
    files: directFiles,
  }
}

export async function createFilebrowserDirectory(path: string) {
  await delay(120)
  const normalized = normalizePath(path)
  mockFolders.add(normalized)
  addLog('INFO', 'file-manager', `创建模拟文件夹：${normalized}`)
  return { ok: true, path: normalized }
}

export async function deleteFilebrowserPath(path: string, toTrash = true) {
  await delay(120)
  const normalized = normalizePath(path)
  const snapshot = removePathFromMock(normalized)
  if (!snapshot) {
    addLog('WARNING', 'file-manager', `Demo 模式：无法删除 ${normalized}`)
    return { ok: false, message: '路径不存在或受保护' }
  }

  if (!toTrash) {
    addLog('WARNING', 'file-manager', `Demo 模式：永久删除 ${normalized}`)
    return { ok: true }
  }

  const isDirectory = snapshot.folders.length > 0
  const trashItem: MockTrashItem = {
    id: `trash-${randomId()}`,
    name: normalized.split('/').filter(Boolean).pop() || normalized,
    original_path: normalized,
    deleted_at: new Date().toISOString(),
    type: isDirectory ? 'directory' : 'file',
    size: trashEntrySize(snapshot),
    stored_path: normalized,
    snapshot,
  }
  mockTrash.unshift(trashItem)
  addLog('WARNING', 'file-manager', `Demo 模式：移入回收站 ${normalized}`)
  return { ok: true }
}

export async function fetchFilebrowserTrash() {
  await delay(100)
  return { ok: true, items: mockTrash.map(toTrashResponse) }
}

export async function restoreFilebrowserTrash(id: string) {
  await delay(120)
  const index = mockTrash.findIndex((item) => item.id === id)
  if (index < 0) return { ok: false, message: '回收站条目不存在' }

  const [item] = mockTrash.splice(index, 1)
  restoreSnapshot(item.snapshot)
  addLog('INFO', 'file-manager', `从回收站恢复：${item.original_path}`)
  return { ok: true }
}

export async function purgeFilebrowserTrash(id: string) {
  await delay(120)
  const index = mockTrash.findIndex((item) => item.id === id)
  if (index < 0) return { ok: false, message: '回收站条目不存在' }

  const [item] = mockTrash.splice(index, 1)
  addLog('WARNING', 'file-manager', `彻底删除回收站条目：${item.original_path}`)
  return { ok: true }
}

export async function emptyFilebrowserTrash() {
  await delay(120)
  mockTrash.splice(0, mockTrash.length)
  addLog('INFO', 'file-manager', 'Demo 模式：清空模拟回收站')
  return { ok: true }
}

export const setWorkspace = async (workspace: string) => ({ ok: true, workspace })
