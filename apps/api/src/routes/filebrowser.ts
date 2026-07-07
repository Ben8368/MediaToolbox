import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import type {
  CreateDirectoryResponse,
  DirectoryListResponse,
  DiskListResponse,
  FileEntry,
  OkResult,
  SetWorkspaceResponse,
  TrashListResponse,
  WorkspaceResponse,
} from '@mediatoolbox/contracts'

import { filebrowserDeleteSchema, filebrowserListSchema, filebrowserMkdirSchema, setWorkspaceSchema } from '../schemas.js'
import { ensureDefaultPhysicalWorkspace, physicalWorkspaceForVirtualRoot, WORKSPACE_ROOT, type ApiState } from '../state.js'
import { addLog, entryName, formatLogTime, nowSeconds } from '../utils.js'
import { toPhysicalWorkspacePath, toVirtualWorkspacePath } from '../workspace-files.js'
import { normalizeWorkspacePath } from '../workspace-path.js'

const TRASH_DIR = '.trash'
const UPLOAD_SIZE_LIMIT = 500 * 1024 * 1024 // 500 MB

export function registerFilebrowserRoutes(app: FastifyInstance, state: ApiState) {
  void app.register(multipart, { limits: { fileSize: UPLOAD_SIZE_LIMIT } })
  app.get<{ Reply: WorkspaceResponse }>('/api/filebrowser/workspace', async () => ({
    ok: true,
    project_root: state.workspaceRoot,
    workspace: { project_root: state.workspaceRoot, downloads: `${state.workspaceRoot}/Downloads`, exports: `${state.workspaceRoot}/Exports` },
  }))

  app.put<{ Body: { workspace?: string }; Reply: SetWorkspaceResponse }>('/api/filebrowser/workspace', { schema: setWorkspaceSchema }, async (request) => {
    const workspace = normalizeWorkspacePath(request.body.workspace, WORKSPACE_ROOT)
    state.workspaceRoot = workspace
    state.physicalWorkspaceRoot = physicalWorkspaceForVirtualRoot(state.physicalWorkspaceBase, workspace)
    ensureDefaultPhysicalWorkspace(state.physicalWorkspaceRoot)
    state.folders = createDefaultFolders(workspace)
    state.files = createDefaultFiles(workspace)
    state.trash = []
    addLog(state.db, 'INFO', 'file-manager', `切换本地工作区：${workspace}`)
    return { ok: true, workspace }
  })

  app.get<{ Reply: DiskListResponse }>('/api/filebrowser/disks', async () => {
    const usage = await readWorkspaceUsage(state.physicalWorkspaceRoot)
    return {
      ok: true,
      disks: [{ name: 'Workspace', path: state.workspaceRoot, ...usage }],
    }
  })

  app.post<{ Body: { directory?: string }; Reply: DirectoryListResponse }>('/api/filebrowser/list', { schema: filebrowserListSchema }, async (request) => {
    const directory = normalizeWorkspacePath(request.body.directory, state.workspaceRoot)
    const physicalDirectory = toPhysicalWorkspacePath(state, directory)
    const entries = await fs.readdir(physicalDirectory, { withFileTypes: true })
    const directories: FileEntry[] = []
    const files: FileEntry[] = []

    for (const item of entries) {
      if (item.name === TRASH_DIR) continue
      const physicalPath = path.join(physicalDirectory, item.name)
      const stat = await fs.stat(physicalPath)
      const virtualPath = toVirtualWorkspacePath(state, physicalPath)
      const entry: FileEntry = {
        name: item.name,
        path: virtualPath,
        size: item.isDirectory() ? 0 : stat.size,
        modified: formatLogTime(stat.mtime),
        type: item.isDirectory() ? 'directory' : 'file',
      }
      if (!item.isDirectory()) entry.extension = extensionFromName(item.name)
      if (item.isDirectory()) directories.push(entry)
      else files.push(entry)
    }

    return { ok: true, path: directory, directories, files }
  })

  app.post<{ Body: { path?: string }; Reply: CreateDirectoryResponse }>('/api/filebrowser/mkdir', { schema: filebrowserMkdirSchema }, async (request) => {
    const virtualPath = normalizeWorkspacePath(request.body.path, state.workspaceRoot)
    await fs.mkdir(toPhysicalWorkspacePath(state, virtualPath), { recursive: true })
    addLog(state.db, 'INFO', 'file-manager', `创建本地目录：${virtualPath}`)
    return { ok: true, path: virtualPath }
  })

  app.delete<{ Body: { path?: string; to_trash?: boolean }; Reply: OkResult }>('/api/filebrowser/path', { schema: filebrowserDeleteSchema }, async (request) => {
    const virtualPath = normalizeWorkspacePath(request.body.path, state.workspaceRoot)
    if (virtualPath === state.workspaceRoot) return { ok: false, message: '工作区根目录受保护。' }

    const physicalPath = toPhysicalWorkspacePath(state, virtualPath)
    const stat = await fs.stat(physicalPath).catch(() => undefined)
    if (!stat) return { ok: false, message: '路径不存在。' }

    if (stat.isDirectory() && (await hasVisibleChildren(physicalPath))) {
      return { ok: false, message: '目录不为空，请先删除其中的内容。' }
    }

    if (request.body.to_trash === false) {
      await removePhysicalPath(physicalPath, stat.isDirectory())
      return { ok: true }
    }

    const id = createTrashId(state)
    const trashPhysicalPath = path.join(state.physicalWorkspaceRoot, TRASH_DIR, id)
    await fs.mkdir(path.dirname(trashPhysicalPath), { recursive: true })
    await fs.rename(physicalPath, trashPhysicalPath)
    state.trash.unshift({
      id,
      name: entryName(virtualPath),
      original_path: virtualPath,
      deleted_at: nowSeconds(),
      type: stat.isDirectory() ? 'directory' : 'file',
      size: stat.isDirectory() ? 0 : stat.size,
      stored_path: `${state.workspaceRoot}/.Trash/${id}`,
    })
    return { ok: true }
  })

  app.get<{ Reply: TrashListResponse }>('/api/filebrowser/trash', async () => ({ ok: true, items: state.trash }))

  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/filebrowser/trash/:id/restore', async (request) => {
    const index = state.trash.findIndex((item) => item.id === request.params.id)
    if (index < 0) return { ok: false, message: '回收站条目不存在。' }
    const [item] = state.trash.splice(index, 1)
    if (!item) return { ok: false, message: '回收站条目不存在。' }

    const from = path.join(state.physicalWorkspaceRoot, TRASH_DIR, item.id)
    const to = toPhysicalWorkspacePath(state, item.original_path)
    if (await exists(to)) {
      state.trash.splice(index, 0, item)
      return { ok: false, message: '原路径已存在，无法恢复。' }
    }
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    return { ok: true }
  })

  app.delete<{ Params: { id: string }; Reply: OkResult }>('/api/filebrowser/trash/:id', async (request) => {
    const index = state.trash.findIndex((item) => item.id === request.params.id)
    const [item] = index >= 0 ? state.trash.splice(index, 1) : []
    if (item) {
      await fs.rm(path.join(state.physicalWorkspaceRoot, TRASH_DIR, item.id), { force: true, recursive: true })
    }
    return { ok: true }
  })

  app.delete<{ Reply: OkResult }>('/api/filebrowser/trash', async () => {
    await fs.rm(path.join(state.physicalWorkspaceRoot, TRASH_DIR), { force: true, recursive: true })
    state.trash.splice(0, state.trash.length)
    return { ok: true }
  })

  app.post<{ Reply: OkResult & { path?: string; name?: string } }>('/api/filebrowser/upload', async (request, reply) => {
    const parts = request.parts()
    let directory = state.workspaceRoot
    let saved: { virtualPath: string; name: string } | undefined

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'directory' && typeof part.value === 'string') {
        directory = normalizeWorkspacePath(part.value, state.workspaceRoot)
      } else if (part.type === 'file') {
        const safeName = path.basename(part.filename).replace(/[^\w.\-]/g, '_') || 'upload'
        const physicalDir = toPhysicalWorkspacePath(state, directory)
        await fs.mkdir(physicalDir, { recursive: true })
        const physicalTarget = path.join(physicalDir, safeName)
        const out = await fs.open(physicalTarget, 'w')
        try {
          await pipeline(part.file, out.createWriteStream())
        } finally {
          await out.close()
        }
        const virtualPath = toVirtualWorkspacePath(state, physicalTarget)
        addLog(state.db, 'INFO', 'file-manager', `上传文件：${virtualPath}`)
        saved = { virtualPath, name: safeName }
      }
    }

    if (!saved) return reply.status(400).send({ ok: false, message: '未收到文件。' })
    return { ok: true, path: saved.virtualPath, name: saved.name }
  })

  app.get<{ Querystring: { path?: string } }>('/api/filebrowser/file', async (request, reply) => {
    const virtualPath = normalizeWorkspacePath(request.query.path, state.workspaceRoot)
    const physicalPath = toPhysicalWorkspacePath(state, virtualPath)
    const stat = await fs.stat(physicalPath).catch(() => undefined)
    if (!stat?.isFile()) return reply.status(404).send({ ok: false, message: '文件不存在。' })

    const filename = path.basename(physicalPath)
    void reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    void reply.header('Content-Type', 'application/octet-stream')
    void reply.header('Content-Length', String(stat.size))
    return reply.send(await fs.readFile(physicalPath))
  })
}

async function hasVisibleChildren(physicalPath: string): Promise<boolean> {
  const children = await fs.readdir(physicalPath)
  return children.some((child) => child !== TRASH_DIR)
}

async function removePhysicalPath(physicalPath: string, isDirectory: boolean): Promise<void> {
  if (isDirectory) await fs.rmdir(physicalPath)
  else await fs.unlink(physicalPath)
}

async function readWorkspaceUsage(root: string): Promise<{ total: number; used: number; free: number }> {
  const statfs = await fs.statfs(root).catch(() => undefined)
  const total = statfs ? statfs.blocks * statfs.bsize : 512_000_000_000
  const free = statfs ? statfs.bfree * statfs.bsize : 512_000_000_000
  return { total, free, used: Math.max(0, total - free) }
}

async function exists(physicalPath: string): Promise<boolean> {
  return fs.access(physicalPath).then(() => true).catch(() => false)
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
