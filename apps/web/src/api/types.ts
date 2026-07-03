import type { TrashEntry } from '@/apps/file-manager/types'
import type { RuntimeMetrics } from '@/components/RightPanel/types'

type OkResult = { ok: boolean; message?: string }

export type TaskListResponse = {
  ok: boolean
  tasks?: Array<Record<string, unknown>>
}

export type LogListResponse = {
  ok?: boolean
  total: number
  items: Array<Record<string, unknown>>
  page: number
  page_size: number
  levels?: string[]
}

export type LogMetadataResponse = {
  modules?: string[]
}

export type UnreadNotificationResponse = {
  unread_count?: number
}

export type RuntimeMetricsSlice = Pick<RuntimeMetrics, 'runtime' | 'system' | 'network'>

/** 前端 API 契约：mock 与真实服务实现均需满足此接口 */
export interface MediaToolboxApi {
  submitFetch(draft: Record<string, unknown>): Promise<{ ok: boolean; task_id?: string; status?: string }>
  getActiveTasks(): Promise<TaskListResponse>
  getWeeklyHistory(): Promise<TaskListResponse>
  cancelTask(taskId: string): Promise<OkResult>
  deleteTaskRecord(taskId: string): Promise<OkResult>
  clearTaskRecords(taskIds?: string[]): Promise<OkResult>
  getFetchTaskFileUrl(taskId: string, path: string): string

  getWorkspace(): Promise<{
    ok: boolean
    project_root?: string
    workspace?: { project_root?: string; downloads?: string; exports?: string }
  }>
  fetchFilebrowserDisks(): Promise<{
    ok: boolean
    disks?: Array<{ name: string; path: string; total: number; used: number; free: number }>
  }>
  listFilebrowserDirectory(payload: { directory: string }): Promise<Record<string, unknown>>
  createFilebrowserDirectory(path: string): Promise<{ ok: boolean; path?: string }>
  deleteFilebrowserPath(path: string, toTrash?: boolean): Promise<OkResult>
  fetchFilebrowserTrash(): Promise<{ ok: boolean; items?: TrashEntry[] }>
  restoreFilebrowserTrash(id: string): Promise<OkResult>
  purgeFilebrowserTrash(id: string): Promise<OkResult>
  emptyFilebrowserTrash(): Promise<OkResult>
  setWorkspace(workspace: string): Promise<{ ok: boolean; workspace?: string }>

  getSystemMetrics(): Promise<RuntimeMetrics>
  fetchSystemRuntimeMetrics(): Promise<RuntimeMetricsSlice>
  shutdownSystem(): Promise<OkResult>

  fetchLogs(query?: { level?: string; module?: string; page?: number; page_size?: number }): Promise<LogListResponse>
  fetchLogMetadata(): Promise<LogMetadataResponse>
  clearLogs(): Promise<OkResult>
  getUnreadNotificationCount(): Promise<UnreadNotificationResponse>
  clearNotifications(): Promise<OkResult>
  markAllNotificationsAsRead(): Promise<OkResult>
}
