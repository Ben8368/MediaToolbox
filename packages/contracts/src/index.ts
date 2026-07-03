export type WorkbenchAppId = 'file-manager' | 'download' | 'transcode' | 'ps' | 'settings' | 'logs'

export type OkResult = {
  ok: boolean
  message?: string
}

export type WorkbenchApp = {
  id: WorkbenchAppId
  title: string
  kind: 'core' | 'workbench' | 'system'
}

export type AppsResponse = {
  apps: WorkbenchApp[]
}

export type JobKind = 'download.video' | 'download.audio' | 'download.subtitle' | 'browser.download' | 'media.transcode' | 'psd.batch'

export type JobStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'retrying' | 'canceled'

export type JobProgress = {
  current: number
  total: number
  unit: 'percent' | 'bytes' | 'items' | 'seconds'
}

export type JobRecord = {
  id: string
  kind: JobKind
  status: JobStatus
  title: string
  progress?: JobProgress
  createdAt: number
  updatedAt: number
  errorMessage?: string
}

export type AssetKind = 'video' | 'audio' | 'subtitle' | 'image' | 'psd' | 'folder' | 'document' | 'other'

export type AssetRecord = {
  id: string
  kind: AssetKind
  name: string
  path: string
  size?: number
  mimeType?: string
  createdAt: string
  updatedAt: string
}

export type AssetListResponse = OkResult & {
  assets: AssetRecord[]
}

export type HealthResponse = {
  ok: boolean
  service: string
  version: string
}

export type FetchTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'partial'

export type FetchTaskRecord = {
  id: string
  task_id: string
  title: string
  source_url: string
  status: FetchTaskStatus
  progress: number
  stage: string
  created_at: number
  updated_at: number | null
  started_at: number | null
  completed_at: number | null
  params: Record<string, unknown>
  state?: Record<string, unknown>
  result?: Record<string, unknown>
  output_files?: string[]
  error?: string | null
}

export type SubmitFetchResponse = OkResult & {
  task_id?: string
  task_ids?: string[]
  status?: FetchTaskStatus
}

export type BrowserNetworkDownloadStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export type BrowserNetworkPermissionDecision = 'granted' | 'denied'

export type BrowserNetworkPermissionKind =
  | 'clipboard-read'
  | 'clipboard-sanitized-write'
  | 'display-capture'
  | 'fullscreen'
  | 'geolocation'
  | 'media'
  | 'notifications'
  | 'openExternal'
  | 'storage-access'
  | 'top-level-storage-access'
  | 'fileSystem'
  | 'unknown'

export type BrowserNetworkDownloadRecord = {
  id: string
  job_id: string
  view_id: string
  session_id: string
  source_url: string
  url_chain: string[]
  filename: string
  target_path: string
  status: BrowserNetworkDownloadStatus
  received_bytes: number
  total_bytes: number
  mime_type?: string
  user_gesture: boolean
  created_at: number
  updated_at: number
  completed_at: number | null
  error?: string | null
}

export type BrowserNetworkDownloadListResponse = OkResult & {
  downloads: BrowserNetworkDownloadRecord[]
}

export type BrowserNetworkDownloadResponse = OkResult & {
  download?: BrowserNetworkDownloadRecord
}

export type BrowserNetworkPermissionEvent = {
  view_id: string
  session_id: string
  origin: string
  permission: BrowserNetworkPermissionKind
  decision: BrowserNetworkPermissionDecision
  reason?: string
}

export type BrowserNetworkUploadSelection = {
  view_id: string
  session_id: string
  filename: string
  path: string
  size: number
  confirmed: boolean
}

export type BrowserNetworkUploadSelectionResponse = OkResult & {
  selection?: BrowserNetworkUploadSelection
}

export type TaskListResponse = OkResult & {
  tasks?: FetchTaskRecord[]
}

export type WorkspaceInfo = {
  project_root?: string
  downloads?: string
  exports?: string
}

export type WorkspaceResponse = OkResult & {
  project_root?: string
  workspace?: WorkspaceInfo
}

export type DiskInfo = {
  name: string
  path: string
  total: number
  used: number
  free: number
}

export type DiskListResponse = OkResult & {
  disks?: DiskInfo[]
}

export type FileEntry = {
  name: string
  path: string
  size: number
  modified: string
  type: 'directory' | 'file'
  extension?: string
  original_path?: string
}

export type DirectoryListResponse = OkResult & {
  path: string
  files: FileEntry[]
  directories: FileEntry[]
}

export type CreateDirectoryResponse = OkResult & {
  path?: string
}

export type TrashEntry = {
  id: string
  name: string
  original_path: string
  deleted_at: number
  type: 'directory' | 'file'
  size: number
  stored_path: string
}

export type TrashListResponse = OkResult & {
  items?: TrashEntry[]
}

export type SetWorkspaceResponse = OkResult & {
  workspace?: string
}

export type RuntimeMetrics = {
  runtime?: { uptime_seconds?: number }
  system?: {
    cpu_percent?: number
    memory_percent?: number
    memory_pressure_percent?: number
    memory_pressure_label?: string
    memory_used_bytes?: number
    memory_total_bytes?: number
    memory_free_bytes?: number
    gpu_percent?: number
    gpu_available?: boolean
    gpu_detail?: string
  }
  network?: {
    upload?: { text?: string }
    download?: { text?: string }
    upload_bytes_per_sec?: number
    download_bytes_per_sec?: number
  }
  services?: Array<{
    id: string
    name: string
    online: boolean
    status: string
    runtime_status?: string
    availability_status?: string
    mode?: string
    mode_label?: string
    detail?: string
    dep?: string | null
    experimental?: boolean
  }>
  tasks?: Array<{
    id: string
    name: string
    source?: string
    type: string
    status: string
    status_label?: string
    stage: string
    progress: number
    can_pause?: boolean
    can_resume?: boolean
    can_cancel?: boolean
  }>
  task_summary?: {
    active_downloads?: number
    total_download_records?: number
    terminal_download_records?: number
  }
  log_mode?: string
}

export type RuntimeMetricsSlice = Pick<RuntimeMetrics, 'runtime' | 'system' | 'network'>

export type LogEntry = {
  level: string
  module: string
  time: string
  user: string
  event: string
  message: string
}

export type LogListResponse = OkResult & {
  total: number
  items: LogEntry[]
  page: number
  page_size: number
  levels?: string[]
}

export type LogMetadataResponse = OkResult & {
  modules?: string[]
}

export type UnreadNotificationResponse = OkResult & {
  unread_count?: number
}
