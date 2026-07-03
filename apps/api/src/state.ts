import type { FetchTaskRecord, JobRecord, LogEntry } from '@mediatoolbox/contracts'
import { SqliteDatabase } from '@mediatoolbox/db'
import type { MediaToolboxDatabase } from '@mediatoolbox/db'

import { formatLogTime } from './utils.js'

export const WORKSPACE_ROOT = '/Workspace'

export type ApiFile = {
  name: string
  path: string
  size: number
  extension: string
  type: 'file'
}

export type ApiTrashEntry = {
  id: string
  name: string
  original_path: string
  deleted_at: number
  type: 'directory' | 'file'
  size: number
  stored_path: string
}

export type ApiState = {
  startedAt: number
  workspaceRoot: string
  fetchTasks: FetchTaskRecord[]
  db: MediaToolboxDatabase
  folders: Set<string>
  files: ApiFile[]
  trash: ApiTrashEntry[]
}

const DB_PATH = process.env['MEDIATOOLBOX_DB_PATH'] ?? (process.env['NODE_ENV'] === 'test' ? ':memory:' : 'mediatoolbox.db')

export function createApiState(): ApiState {
  const db = new SqliteDatabase(DB_PATH)

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
    fetchTasks: [],
    db,
    folders: new Set(['/Workspace', '/Workspace/Downloads', '/Workspace/Exports', '/Workspace/PSD', '/Workspace/Transcodes']),
    files: [
      { name: 'README.txt', path: '/Workspace/README.txt', size: 128, extension: 'txt', type: 'file' },
    ],
    trash: [],
  }
}
