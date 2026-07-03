import type { FetchTaskRecord, JobRecord, LogEntry } from '@mediatoolbox/contracts'

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
  jobs: JobRecord[]
  logs: LogEntry[]
  folders: Set<string>
  files: ApiFile[]
  trash: ApiTrashEntry[]
}

export function createApiState(): ApiState {
  return {
    startedAt: Date.now(),
    workspaceRoot: WORKSPACE_ROOT,
    fetchTasks: [],
    jobs: [],
    logs: [
      {
        level: 'INFO',
        module: 'system',
        time: formatLogTime(),
        user: 'api',
        event: '本地 API 骨架已启动',
        message: '本地 API 骨架已启动，真实执行器尚未接入。',
      },
    ],
    folders: new Set(['/Workspace', '/Workspace/Downloads', '/Workspace/Exports', '/Workspace/PSD', '/Workspace/Transcodes']),
    files: [
      { name: 'README.txt', path: '/Workspace/README.txt', size: 128, extension: 'txt', type: 'file' },
    ],
    trash: [],
  }
}
