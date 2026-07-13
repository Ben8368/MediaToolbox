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
  TranscodeProbeResponse,
  TranscodeSourceInfo,
  WorkOrderScanResponse,
  WorkOrderGetResponse,
  WorkOrderApplyResponse,
  WorkOrder,
  RuntimeMetrics,
  RuntimeMetricsSlice,
  SetWorkspaceResponse,
  SubmitFetchResponse,
  TaskListResponse,
  TranscodeCommandPreviewResponse,
  TrashListResponse,
  UnreadNotificationResponse,
  WebComposerCaptureMetadata,
  WorkspaceResponse,
} from '@mediatoolbox/contracts'

export type {
  AssetRecord,
  JobRecord,
  LogListResponse,
  LogMetadataResponse,
  TranscodeCommandPreviewResponse,
  TranscodeProbeResponse,
  TranscodeSourceInfo,
  WorkOrder,
  RuntimeMetricsSlice,
  TaskListResponse,
  UnreadNotificationResponse,
}

export type JobListResponse = OkResult & {
  jobs: JobRecord[]
}

export type TranscodeJobDraft = {
  inputPath?: string
  outputPath?: string
  inputGrantId?: string
  outputGrantId?: string
  preset?: 'mp4-h264-aac' | 'mp4-h265-aac' | 'mkv-h265-aac' | 'audio-aac' | 'audio-mp3' | 'copy' | 'remux'
  title?: string
  videoCrf?: number
  videoEncodePreset?: 'fast' | 'slow' | 'veryslow'
  audioBitrate?: number
  targetBitrateKbps?: number
  enableVmaf?: boolean
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
  getJob(jobId: string): Promise<{ ok: boolean; job?: JobRecord }>
  fetchAssets(): Promise<AssetListResponse>
  submitTranscodeJob(draft: TranscodeJobDraft): Promise<JobRecord>
  cancelJob(jobId: string): Promise<OkResult>
  probeTranscodeSource(draft: { inputPath?: string; inputGrantId?: string }): Promise<TranscodeProbeResponse>
  previewTranscodeCommand(draft: { inputPath?: string; outputPath?: string; preset?: string; videoCrf?: number; videoEncodePreset?: string; audioBitrate?: number; targetBitrateKbps?: number }): Promise<TranscodeCommandPreviewResponse>
  scanPsd(psdPath: string, inputGrantId?: string): Promise<WorkOrderScanResponse>
  getWorkOrder(workOrderId: string): Promise<WorkOrderGetResponse>
  updateWorkOrder(workOrder: WorkOrder): Promise<OkResult>
  applyWorkOrder(workOrderId: string, outputPath?: string, outputGrantId?: string): Promise<WorkOrderApplyResponse>
  submitWebComposerPng(capture: ArrayBuffer, metadata: WebComposerCaptureMetadata): Promise<JobRecord>
  submitWebComposerVideo(capture: ArrayBuffer, metadata: WebComposerCaptureMetadata): Promise<JobRecord>

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
  uploadFilebrowserFile(directory: string, file: File): Promise<OkResult & { path?: string; name?: string }>
  filebrowserFileDownloadUrl(virtualPath: string): string

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
