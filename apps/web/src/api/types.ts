import type {
  AssetListResponse,
  AssetRecord,
  CreateDirectoryResponse,
  DiskListResponse,
  DirectoryListResponse,
  DownloadStrategyResponse,
  JobRecord,
  LogListResponse,
  LogMetadataResponse,
  OkResult,
  PsdRenderInput,
  PsdTemplateManifest,
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
  AssetRecord,
  JobRecord,
  LogListResponse,
  LogMetadataResponse,
  PsdRenderInput,
  PsdTemplateManifest,
  RuntimeMetricsSlice,
  TaskListResponse,
  UnreadNotificationResponse,
}

export type JobListResponse = OkResult & {
  jobs: JobRecord[]
}

export type TranscodeJobDraft = {
  inputPath: string
  outputPath: string
  preset?: 'mp4-h264-aac' | 'audio-mp3' | 'copy'
  title?: string
}

export type PsdInspectResponse = OkResult & {
  manifest?: PsdTemplateManifest
}

/** 前端 API 契约：mock 与真实服务实现均需满足此接口 */
export interface MediaToolboxApi {
  submitFetch(draft: Record<string, unknown>): Promise<SubmitFetchResponse>
  analyzeDownloadStrategy(draft: { url: string; requested_route?: 'auto' | 'ytdlp' | 'browser' }): Promise<DownloadStrategyResponse>
  getActiveTasks(): Promise<TaskListResponse>
  getWeeklyHistory(): Promise<TaskListResponse>
  cancelTask(taskId: string): Promise<OkResult>
  deleteTaskRecord(taskId: string): Promise<OkResult>
  clearTaskRecords(taskIds?: string[]): Promise<OkResult>
  getFetchTaskFileUrl(taskId: string, path: string): string

  listJobs(): Promise<JobListResponse>
  fetchAssets(): Promise<AssetListResponse>
  submitTranscodeJob(draft: TranscodeJobDraft): Promise<JobRecord>
  cancelJob(jobId: string): Promise<OkResult>
  inspectPsdTemplate(psdPath: string): Promise<PsdInspectResponse>
  renderPsdTemplate(template: PsdTemplateManifest, input: PsdRenderInput): Promise<OkResult & { outputPath?: string }>
  savePsdManifest(manifest: PsdTemplateManifest): Promise<OkResult>
  loadPsdManifest(psdPath: string): Promise<PsdInspectResponse>

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
  fetchNotifications(query?: { level?: string; page?: number; page_size?: number; unread_only?: boolean }): Promise<LogListResponse>
  clearNotifications(): Promise<OkResult>
  markAllNotificationsAsRead(): Promise<OkResult>
}
