import type { BrowserNetworkDownloadRecord, BrowserNetworkRequestRecord, FetchTaskRecord, JobRecord, LogEntry } from '@mediatoolbox/contracts'
import { SqliteDatabase } from '@mediatoolbox/db'
import type { MediaToolboxDatabase } from '@mediatoolbox/db'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { ProjectNetworkSample } from './system-sampler.js'
import { formatLogTime } from './utils.js'

export const WORKSPACE_ROOT = '/Workspace'
const MAX_GLOBAL_DOWNLOAD_CONCURRENCY = 4

export type ApiFile = {
  name: string
  path: string
  size: number
  extension: string
  type: 'file'
}

export type ApiState = {
  startedAt: number
  workspaceRoot: string
  physicalWorkspaceBase: string
  physicalWorkspaceRoot: string
  maxConcurrentDownloads: number
  fetchTasks: FetchTaskRecord[]
  browserDownloads: BrowserNetworkDownloadRecord[]
  browserRequests: BrowserNetworkRequestRecord[]
  filebrowserUploadedBytes: number
  networkSample: ProjectNetworkSample
  db: MediaToolboxDatabase
  notificationsReadAt: string | null
  folders: Set<string>
  files: ApiFile[]
}

function resolveDbPath(): string {
  return process.env['MEDIATOOLBOX_DB_PATH'] ?? (process.env['NODE_ENV'] === 'test' ? ':memory:' : 'mediatoolbox.db')
}

let testWorkspaceCounter = 0

export function createApiState(): ApiState {
  const db = new SqliteDatabase(resolveDbPath())
  const physicalWorkspaceBase = resolvePhysicalWorkspaceBase()
  const physicalWorkspaceRoot = physicalWorkspaceForVirtualRoot(physicalWorkspaceBase, WORKSPACE_ROOT)
  ensureDefaultPhysicalWorkspace(physicalWorkspaceRoot)

  void db.logs.create({
    level: 'INFO',
    module: 'system',
    time: formatLogTime(),
    user: 'api',
    event: '本地 API 启动',
    message: '本地 API 已启动，SQLite 持久化已接入。',
  })

  return {
    startedAt: Date.now(),
    workspaceRoot: WORKSPACE_ROOT,
    physicalWorkspaceBase,
    physicalWorkspaceRoot,
    maxConcurrentDownloads: Math.max(1, Math.min(os.cpus().length, MAX_GLOBAL_DOWNLOAD_CONCURRENCY)),
    fetchTasks: [],
    browserDownloads: [],
    browserRequests: [],
    filebrowserUploadedBytes: 0,
    networkSample: { at: Date.now(), browserReceivedBytes: 0, browserResponseBytes: 0, browserRequestBytes: 0, filebrowserUploadedBytes: 0 },
    db,
    notificationsReadAt: null,
    folders: new Set(['/Workspace', '/Workspace/Downloads', '/Workspace/Exports', '/Workspace/PSD', '/Workspace/Transcodes']),
    files: [
      { name: 'README.txt', path: '/Workspace/README.txt', size: 128, extension: 'txt', type: 'file' },
    ],
  }
}

export function physicalWorkspaceForVirtualRoot(base: string, virtualRoot: string): string {
  const relativeSegments = virtualRoot.replace(/^\/Workspace\/?/, '').split('/').filter(Boolean)
  const resolved = path.resolve(base, ...relativeSegments)
  const normalizedBase = path.resolve(base)
  if (resolved !== normalizedBase && !resolved.startsWith(`${normalizedBase}${path.sep}`)) {
    throw new Error('Physical workspace root escaped its base directory.')
  }
  return resolved
}

export function ensureDefaultPhysicalWorkspace(root: string): void {
  fs.mkdirSync(root, { recursive: true })
  for (const dirname of ['Downloads', 'Exports', 'PSD', 'Transcodes']) {
    fs.mkdirSync(path.join(root, dirname), { recursive: true })
  }
  const readmePath = path.join(root, 'README.txt')
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, 'MediaToolbox workspace\n', 'utf8')
  }
}

function resolvePhysicalWorkspaceBase(): string {
  const configured = process.env['MEDIATOOLBOX_WORKSPACE_DIR']?.trim()
  if (configured) return path.resolve(configured)
  if (process.env['NODE_ENV'] === 'test') {
    testWorkspaceCounter += 1
    return path.join(os.tmpdir(), `api-workspace-${process.pid}-${Date.now()}-${testWorkspaceCounter}`)
  }
  return path.resolve(process.cwd(), '..', '..', '.tmp', 'workspace')
}

function findRepoRoot(start: string): string {
  let current = path.resolve(start)
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'apps'))) return current
    const parent = path.dirname(current)
    if (parent === current) return path.resolve(start)
    current = parent
  }
}
