import Fastify from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type {
  AppsResponse,
  CreateDirectoryResponse,
  DirectoryListResponse,
  DiskListResponse,
  FetchTaskRecord,
  HealthResponse,
  JobRecord,
  LogEntry,
  LogListResponse,
  LogMetadataResponse,
  OkResult,
  RuntimeMetrics,
  RuntimeMetricsSlice,
  SetWorkspaceResponse,
  SubmitFetchResponse,
  TaskListResponse,
  TrashListResponse,
  UnreadNotificationResponse,
  WorkspaceResponse,
} from '@mediatoolbox/contracts'

const startedAt = Date.now()
const workspaceRoot = '/Workspace'
const fetchTasks: FetchTaskRecord[] = []
const jobs: JobRecord[] = []
const logs: LogEntry[] = [
  {
    level: 'INFO',
    module: 'system',
    time: formatLogTime(),
    user: 'api',
    event: '本地 API 骨架已启动',
    message: '本地 API 骨架已启动，真实执行器尚未接入。',
  },
]

const folders = new Set(['/Workspace', '/Workspace/Downloads', '/Workspace/Exports', '/Workspace/PSD', '/Workspace/Transcodes'])
const files = [
  { name: 'README.txt', path: '/Workspace/README.txt', size: 128, extension: 'txt', type: 'file' as const },
]
const trash: Array<{
  id: string
  name: string
  original_path: string
  deleted_at: string
  type: 'directory' | 'file'
  size: number
  stored_path: string
}> = []

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function formatLogTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function addLog(level: string, module: string, message: string) {
  logs.unshift({ level, module, time: formatLogTime(), user: 'api', event: message, message })
}

function normalizePath(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  if (!normalized || normalized === '.') return workspaceRoot
  return normalized.startsWith('/') ? normalized : `${workspaceRoot}/${normalized}`
}

function parentPath(path: string) {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

function entryName(path: string) {
  return path.split('/').filter(Boolean).pop() || path
}

function titleFromDraft(draft: Record<string, unknown>) {
  const urls = Array.isArray(draft.urls) ? draft.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  const source = urls[0] ?? (typeof draft.url === 'string' ? draft.url : '')
  if (!source) return '待接入下载任务'
  try {
    const parsed = new URL(source)
    return `${parsed.hostname.replace(/^www\./, '')} 下载任务`
  } catch {
    return source.length > 48 ? `${source.slice(0, 45)}...` : source
  }
}

function taskSourceFromDraft(draft: Record<string, unknown>) {
  const urls = Array.isArray(draft.urls) ? draft.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  return urls.length ? urls.join(', ') : String(draft.url || '')
}

function isTerminalTask(task: FetchTaskRecord) {
  return ['completed', 'failed', 'cancelled', 'paused', 'partial'].includes(task.status)
}

function service(id: string, name: string) {
  return {
    id,
    name,
    online: true,
    status: '骨架',
    runtime_status: 'ready',
    availability_status: 'stub',
    mode: 'skeleton',
    mode_label: '骨架模式',
    detail: '契约已接入，真实执行器待实现。',
  }
}

function buildMetrics(): RuntimeMetrics {
  const activeTasks = fetchTasks.filter((task) => !isTerminalTask(task))
  return {
    runtime: { uptime_seconds: Math.floor((Date.now() - startedAt) / 1000) },
    system: {
      cpu_percent: 0,
      memory_percent: 0,
      gpu_percent: 0,
      gpu_available: false,
      gpu_detail: '系统指标采集器待接入。',
    },
    network: {
      upload: { text: '0 B/s' },
      download: { text: '0 B/s' },
      upload_bytes_per_sec: 0,
      download_bytes_per_sec: 0,
    },
    services: [service('api', '本地 API'), service('downloader', '下载服务'), service('file-manager', '文件管理')],
    tasks: activeTasks.map((task) => ({
      id: task.id,
      name: task.title,
      source: task.source_url,
      type: 'download',
      status: task.status,
      status_label: task.status === 'pending' ? '等待中' : task.status,
      stage: task.stage,
      progress: task.progress,
      can_cancel: task.status === 'pending' || task.status === 'running',
    })),
    task_summary: {
      active_downloads: activeTasks.length,
      total_download_records: fetchTasks.length,
      terminal_download_records: fetchTasks.filter(isTerminalTask).length,
    },
    log_mode: 'api-skeleton',
  }
}

export function buildApiServer() {
  const app = Fastify({ logger: true })

  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    ok: true,
    service: 'mediatoolbox-api',
    version: '0.1.0',
  }))

  app.get<{ Reply: AppsResponse }>('/api/apps', async () => ({
    apps: [
      { id: 'file-manager', title: '文件管理', kind: 'core' },
      { id: 'download', title: '下载', kind: 'workbench' },
      { id: 'transcode', title: '转码', kind: 'workbench' },
      { id: 'ps', title: 'PS', kind: 'workbench' },
      { id: 'settings', title: '设置', kind: 'system' },
      { id: 'logs', title: '日志', kind: 'system' },
    ],
  }))

  app.post<{ Body: Record<string, unknown>; Reply: SubmitFetchResponse }>('/api/fetch/tasks', async (request) => {
    const createdAt = nowSeconds()
    const id = `fetch-${createdAt}-${fetchTasks.length + 1}`
    const task: FetchTaskRecord = {
      id,
      task_id: id,
      title: titleFromDraft(request.body),
      source_url: taskSourceFromDraft(request.body),
      status: 'pending',
      progress: 0,
      stage: '等待下载执行器接入',
      created_at: createdAt,
      updated_at: createdAt,
      started_at: null,
      completed_at: null,
      params: request.body,
      state: { mode: 'api-skeleton', note: '后端已接收任务，真实下载执行器尚未接入。' },
    }
    fetchTasks.unshift(task)
    addLog('NOTICE', 'downloader', `创建下载任务骨架：${task.title}`)
    return { ok: true, task_id: id, status: task.status }
  })

  app.get<{ Reply: TaskListResponse }>('/api/fetch/tasks', async () => ({
    ok: true,
    tasks: fetchTasks.filter((task) => !isTerminalTask(task)),
  }))

  app.get<{ Reply: TaskListResponse }>('/api/fetch/tasks/history', async () => ({
    ok: true,
    tasks: fetchTasks.filter(isTerminalTask),
  }))

  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/fetch/tasks/:id/cancel', async (request) => {
    const task = fetchTasks.find((item) => item.id === request.params.id || item.task_id === request.params.id)
    if (task && !isTerminalTask(task)) {
      task.status = 'cancelled'
      task.stage = '任务已取消'
      task.updated_at = nowSeconds()
      task.completed_at = task.updated_at
      addLog('WARNING', 'downloader', `取消下载任务骨架：${task.title}`)
    }
    return { ok: true }
  })

  app.delete<{ Params: { id: string }; Reply: OkResult }>('/api/fetch/tasks/:id', async (request) => {
    const index = fetchTasks.findIndex((item) => item.id === request.params.id || item.task_id === request.params.id)
    if (index >= 0) fetchTasks.splice(index, 1)
    return { ok: true }
  })

  app.post<{ Body: { task_ids?: string[] }; Reply: OkResult }>('/api/fetch/tasks/clear', async (request) => {
    const ids = new Set(request.body.task_ids ?? [])
    for (let index = fetchTasks.length - 1; index >= 0; index -= 1) {
      const task = fetchTasks[index]
      if (!task) continue
      if ((ids.size === 0 && isTerminalTask(task)) || ids.has(task.id) || ids.has(task.task_id)) fetchTasks.splice(index, 1)
    }
    return { ok: true }
  })

  app.get<{ Params: { id: string }; Querystring: { path?: string } }>('/api/fetch/tasks/:id/file', async (request, reply) => {
    const path = request.query.path || ''
    return reply.type('text/plain; charset=utf-8').send(`任务 ${request.params.id} 的文件访问尚未接入：${path}`)
  })

  app.get<{ Reply: WorkspaceResponse }>('/api/filebrowser/workspace', async () => ({
    ok: true,
    project_root: workspaceRoot,
    workspace: { project_root: workspaceRoot, downloads: '/Workspace/Downloads', exports: '/Workspace/Exports' },
  }))

  app.put<{ Body: { workspace?: string }; Reply: SetWorkspaceResponse }>('/api/filebrowser/workspace', async (request) => ({
    ok: true,
    workspace: normalizePath(request.body.workspace || workspaceRoot),
  }))

  app.get<{ Reply: DiskListResponse }>('/api/filebrowser/disks', async () => ({
    ok: true,
    disks: [{ name: 'Workspace', path: workspaceRoot, total: 512_000_000_000, used: 0, free: 512_000_000_000 }],
  }))

  app.post<{ Body: { directory?: string }; Reply: DirectoryListResponse }>('/api/filebrowser/list', async (request) => {
    const directory = normalizePath(request.body.directory || workspaceRoot)
    return {
      ok: true,
      path: folders.has(directory) ? directory : workspaceRoot,
      directories: Array.from(folders)
        .filter((path) => parentPath(path) === directory)
        .map((path) => ({ name: entryName(path), path, size: 0, modified: formatLogTime(), type: 'directory' })),
      files: files
        .filter((file) => parentPath(file.path) === directory)
        .map((file) => ({ ...file, modified: formatLogTime() })),
    }
  })

  app.post<{ Body: { path?: string }; Reply: CreateDirectoryResponse }>('/api/filebrowser/mkdir', async (request) => {
    const path = normalizePath(request.body.path || workspaceRoot)
    folders.add(path)
    addLog('INFO', 'file-manager', `创建虚拟目录：${path}`)
    return { ok: true, path }
  })

  app.delete<{ Body: { path?: string; to_trash?: boolean }; Reply: OkResult }>('/api/filebrowser/path', async (request) => {
    const path = normalizePath(request.body.path || workspaceRoot)
    if (path === workspaceRoot) return { ok: false, message: '工作区根目录受保护。' }
    const fileIndex = files.findIndex((file) => file.path === path)
    if (fileIndex >= 0) {
      const [file] = files.splice(fileIndex, 1)
      if (file && request.body.to_trash !== false) {
        trash.unshift({ id: `trash-${Date.now()}`, name: file.name, original_path: file.path, deleted_at: new Date().toISOString(), type: 'file', size: file.size, stored_path: file.path })
      }
      return { ok: true }
    }
    if (!folders.delete(path)) return { ok: false, message: '路径不存在。' }
    if (request.body.to_trash !== false) {
      trash.unshift({ id: `trash-${Date.now()}`, name: entryName(path), original_path: path, deleted_at: new Date().toISOString(), type: 'directory', size: 0, stored_path: path })
    }
    return { ok: true }
  })

  app.get<{ Reply: TrashListResponse }>('/api/filebrowser/trash', async () => ({ ok: true, items: trash }))
  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/filebrowser/trash/:id/restore', async () => ({ ok: true }))
  app.delete<{ Params: { id: string }; Reply: OkResult }>('/api/filebrowser/trash/:id', async (request) => {
    const index = trash.findIndex((item) => item.id === request.params.id)
    if (index >= 0) trash.splice(index, 1)
    return { ok: true }
  })
  app.delete<{ Reply: OkResult }>('/api/filebrowser/trash', async () => {
    trash.splice(0, trash.length)
    return { ok: true }
  })

  app.get<{ Reply: RuntimeMetrics }>('/api/system/metrics', async () => buildMetrics())
  app.get<{ Reply: RuntimeMetricsSlice }>('/api/system/runtime', async () => {
    const metrics = buildMetrics()
    const slice: RuntimeMetricsSlice = {}
    if (metrics.runtime) slice.runtime = metrics.runtime
    if (metrics.system) slice.system = metrics.system
    if (metrics.network) slice.network = metrics.network
    return slice
  })
  app.post<{ Reply: OkResult }>('/api/system/shutdown', async () => ({ ok: true, message: '骨架模式不会关闭本地服务。' }))

  app.get<{ Querystring: { level?: string; module?: string; page?: number; page_size?: number }; Reply: LogListResponse }>('/api/logs', async (request) => {
    const page = Math.max(1, Number(request.query.page || 1))
    const pageSize = Math.max(1, Number(request.query.page_size || 50))
    const filtered = logs
      .filter((item) => !request.query.level || item.level === request.query.level)
      .filter((item) => !request.query.module || item.module === request.query.module)
    return { ok: true, total: filtered.length, items: filtered.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, levels: ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL'] }
  })
  app.get<{ Reply: LogMetadataResponse }>('/api/logs/metadata', async () => ({ ok: true, modules: ['system', 'downloader', 'file-manager'] }))
  app.delete<{ Reply: OkResult }>('/api/logs', async () => {
    logs.splice(0, logs.length)
    return { ok: true }
  })

  app.get<{ Reply: UnreadNotificationResponse }>('/api/notifications/unread-count', async () => ({
    ok: true,
    unread_count: logs.filter((item) => item.level === 'WARNING' || item.level === 'ERROR').length,
  }))
  app.delete<{ Reply: OkResult }>('/api/notifications', async () => ({ ok: true }))
  app.post<{ Reply: OkResult }>('/api/notifications/read-all', async () => ({ ok: true }))

  app.post<{ Body: { kind?: string; title?: string }; Reply: JobRecord }>('/api/jobs', async (request) => {
    const job = createJobRecord({ id: `job-${Date.now()}`, kind: 'download.video', title: request.body.title || '骨架任务' })
    jobs.unshift(job)
    return job
  })
  app.get<{ Reply: { ok: boolean; jobs: JobRecord[] } }>('/api/jobs', async () => ({ ok: true, jobs }))
  app.get<{ Params: { id: string }; Reply: { ok: boolean; job?: JobRecord } }>('/api/jobs/:id', async (request) => {
    const job = jobs.find((item) => item.id === request.params.id)
    return job ? { ok: true, job } : { ok: true }
  })
  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/jobs/:id/cancel', async () => ({ ok: true, message: '任务队列执行器待接入。' }))

  return app
}
