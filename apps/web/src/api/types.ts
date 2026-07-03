import type {
  CreateDirectoryResponse,
  DiskListResponse,
  DirectoryListResponse,
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

export type {
  LogListResponse,
  LogMetadataResponse,
  RuntimeMetricsSlice,
  TaskListResponse,
  UnreadNotificationResponse,
}

/** 前端 API 契约：mock 与真实服务实现均需满足此接口 */
export interface MediaToolboxApi {
  submitFetch(draft: Record<string, unknown>): Promise<SubmitFetchResponse>
  getActiveTasks(): Promise<TaskListResponse>
  getWeeklyHistory(): Promise<TaskListResponse>
  cancelTask(taskId: string): Promise<OkResult>
  deleteTaskRecord(taskId: string): Promise<OkResult>
  clearTaskRecords(taskIds?: string[]): Promise<OkResult>
  getFetchTaskFileUrl(taskId: string, path: string): string

  getWorkspace(): Promise<WorkspaceResponse>
  fetchFilebrowserDisks(): Promise<DiskListResponse>
  listFilebrowserDirectory(payload: { directory: string }): Promise<DirectoryListResponse>
  createFilebrowserDirectory(path: string): Promise<CreateDirectoryResponse>
  deleteFilebrowserPath(path: string, toTrash?: boolean): Promise<OkResult>
  fetchFilebrowserTrash(): Promise<TrashListResponse>
  restoreFilebrowserTrash(id: string): Promise<OkResult>
  purgeFilebrowserTrash(id: string): Promise<OkResult>
  emptyFilebrowserTrash(): Promise<OkResult>
  setWorkspace(workspace: string): Promise<SetWorkspaceResponse>

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
