import type { FastifyInstance } from 'fastify'
import type {
  CreateDirectoryResponse,
  DirectoryListResponse,
  DiskListResponse,
  OkResult,
  SetWorkspaceResponse,
  TrashListResponse,
  WorkspaceResponse,
} from '@mediatoolbox/contracts'

import { filebrowserDeleteSchema, filebrowserListSchema, filebrowserMkdirSchema, setWorkspaceSchema } from '../schemas.js'
import { WORKSPACE_ROOT, type ApiState } from '../state.js'
import { addLog, entryName, formatLogTime, nowSeconds } from '../utils.js'
import { normalizeWorkspacePath, parentWorkspacePath } from '../workspace-path.js'

export function registerFilebrowserRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Reply: WorkspaceResponse }>('/api/filebrowser/workspace', async () => ({
    ok: true,
    project_root: state.workspaceRoot,
    workspace: { project_root: state.workspaceRoot, downloads: `${state.workspaceRoot}/Downloads`, exports: `${state.workspaceRoot}/Exports` },
  }))

  app.put<{ Body: { workspace?: string }; Reply: SetWorkspaceResponse }>('/api/filebrowser/workspace', { schema: setWorkspaceSchema }, async (request) => {
    const workspace = normalizeWorkspacePath(request.body.workspace, WORKSPACE_ROOT)
    state.workspaceRoot = workspace
    state.folders = createDefaultFolders(workspace)
    state.files = createDefaultFiles(workspace)
    state.trash = []
    addLog(state.db, 'INFO', 'file-manager', `切换虚拟工作区：${workspace}`)
    return { ok: true, workspace }
  })

  app.get<{ Reply: DiskListResponse }>('/api/filebrowser/disks', async () => ({
    ok: true,
    disks: [{ name: 'Workspace', path: state.workspaceRoot, total: 512_000_000_000, used: 0, free: 512_000_000_000 }],
  }))

  app.post<{ Body: { directory?: string }; Reply: DirectoryListResponse }>('/api/filebrowser/list', { schema: filebrowserListSchema }, async (request) => {
    const directory = normalizeWorkspacePath(request.body.directory, state.workspaceRoot)
    return {
      ok: true,
      path: state.folders.has(directory) ? directory : state.workspaceRoot,
      directories: Array.from(state.folders)
        .filter((path) => parentWorkspacePath(path, state.workspaceRoot) === directory)
        .map((path) => ({ name: entryName(path), path, size: 0, modified: formatLogTime(), type: 'directory' })),
      files: state.files
        .filter((file) => parentWorkspacePath(file.path, state.workspaceRoot) === directory)
        .map((file) => ({ ...file, modified: formatLogTime() })),
    }
  })

  app.post<{ Body: { path?: string }; Reply: CreateDirectoryResponse }>('/api/filebrowser/mkdir', { schema: filebrowserMkdirSchema }, async (request) => {
    const path = normalizeWorkspacePath(request.body.path, state.workspaceRoot)
    state.folders.add(path)
    addLog(state.db, 'INFO', 'file-manager', `创建虚拟目录：${path}`)
    return { ok: true, path }
  })

  app.delete<{ Body: { path?: string; to_trash?: boolean }; Reply: OkResult }>('/api/filebrowser/path', { schema: filebrowserDeleteSchema }, async (request) => {
    const path = normalizeWorkspacePath(request.body.path, state.workspaceRoot)
    if (path === state.workspaceRoot) return { ok: false, message: '工作区根目录受保护。' }
    const fileIndex = state.files.findIndex((file) => file.path === path)
    if (fileIndex >= 0) {
      const [file] = state.files.splice(fileIndex, 1)
      if (file && request.body.to_trash !== false) {
        state.trash.unshift({ id: createTrashId(state), name: file.name, original_path: file.path, deleted_at: nowSeconds(), type: 'file', size: file.size, stored_path: file.path })
      }
      return { ok: true }
    }
    const hasChildFolder = Array.from(state.folders).some((folder) => parentWorkspacePath(folder, state.workspaceRoot) === path)
    const hasChildFile = state.files.some((file) => parentWorkspacePath(file.path, state.workspaceRoot) === path)
    if (hasChildFolder || hasChildFile) return { ok: false, message: '目录不为空，请先删除其中的内容。' }
    if (!state.folders.delete(path)) return { ok: false, message: '路径不存在。' }
    if (request.body.to_trash !== false) {
      state.trash.unshift({ id: createTrashId(state), name: entryName(path), original_path: path, deleted_at: nowSeconds(), type: 'directory', size: 0, stored_path: path })
    }
    return { ok: true }
  })

  app.get<{ Reply: TrashListResponse }>('/api/filebrowser/trash', async () => ({ ok: true, items: state.trash }))
  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/filebrowser/trash/:id/restore', async (request) => {
    const index = state.trash.findIndex((item) => item.id === request.params.id)
    if (index < 0) return { ok: false, message: '回收站条目不存在。' }
    const [item] = state.trash.splice(index, 1)
    if (!item) return { ok: false, message: '回收站条目不存在。' }
    if (item.type === 'directory') {
      state.folders.add(item.original_path)
    } else if (!state.files.some((file) => file.path === item.original_path)) {
      state.files.push({ name: item.name, path: item.original_path, size: item.size, extension: extensionFromName(item.name), type: 'file' })
    }
    return { ok: true }
  })
  app.delete<{ Params: { id: string }; Reply: OkResult }>('/api/filebrowser/trash/:id', async (request) => {
    const index = state.trash.findIndex((item) => item.id === request.params.id)
    if (index >= 0) state.trash.splice(index, 1)
    return { ok: true }
  })
  app.delete<{ Reply: OkResult }>('/api/filebrowser/trash', async () => {
    state.trash.splice(0, state.trash.length)
    return { ok: true }
  })
}

function createDefaultFolders(workspaceRoot: string) {
  return new Set([workspaceRoot, `${workspaceRoot}/Downloads`, `${workspaceRoot}/Exports`, `${workspaceRoot}/PSD`, `${workspaceRoot}/Transcodes`])
}

function createDefaultFiles(workspaceRoot: string) {
  return [
    { name: 'README.txt', path: `${workspaceRoot}/README.txt`, size: 128, extension: 'txt', type: 'file' as const },
  ]
}

function createTrashId(state: ApiState) {
  return `trash-${Date.now()}-${state.trash.length + 1}`
}

function extensionFromName(name: string) {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1) : ''
}
