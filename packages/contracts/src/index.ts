export type WorkbenchAppId = 'browser' | 'file-manager' | 'fetcher' | 'transcode' | 'ps' | 'settings' | 'logs'

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

export type JobKind = 'download.video' | 'download.audio' | 'download.subtitle' | 'browser.download' | 'browser.request' | 'media.transcode' | 'psd.apply'

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

// PS 工作台 — 工单系统

export type SoChainEntry = {
  fileRef: string
  layerPath: string
}

export type TextLayerRecord = {
  id: string
  layerId: number
  layerPath: string
  soChain: SoChainEntry[]
  enabled: boolean
  // 扫描阶段读取（只读）
  originalText: string
  originalFontFamily: string
  originalFontStyle: string
  originalFontPs: string
  originalSizePt: number
  originalLeadingPt: number | null
  originalTrackingValue: number
  boundsHPx: number
  boundsWPx: number
  fakesBold: boolean
  // 工单填写字段（用户修改）
  newText?: string
  newFontFamily?: string
  newFontStyle?: string
  // AI 翻译预留
  targetLanguage?: string
  translationPrompt?: string
}

export type WorkOrder = {
  id: string
  psdPath: string
  psdFileName: string
  documentWidth: number
  documentHeight: number
  documentResolution: number
  createdAt: number
  updatedAt: number
  records: TextLayerRecord[]
}

export type TranslationLanguage = 'ja' | 'zh' | 'pt' | 'en' | 'ko' | 'fr' | 'de' | 'es'

export type WorkOrderScanResponse = OkResult & {
  workOrderId?: string
  recordCount?: number
}

export type WorkOrderGetResponse = OkResult & {
  workOrder?: WorkOrder
}

export type WorkOrderApplyResponse = OkResult & {
  outputPath?: string
  appliedCount?: number
  skippedCount?: number
}

export type WorkOrderTranslateResponse = OkResult & {
  updatedRecords?: TextLayerRecord[]
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

export type BrowserNetworkSessionScope = 'default' | 'isolated'

export type BrowserNetworkHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type BrowserNetworkRequestStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export type BrowserNetworkDownloadRoute = 'auto' | 'ytdlp' | 'browser'

export type BrowserNetworkRequestMode = 'browser-session'

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

export type BrowserNetworkRequestRecord = {
  id: string
  job_id: string
  view_id: string
  session_id: string
  mode: BrowserNetworkRequestMode
  method: BrowserNetworkHttpMethod
  url: string
  status: BrowserNetworkRequestStatus
  request_headers: Record<string, string>
  response_status?: number
  response_headers?: Record<string, string>
  response_bytes: number
  request_bytes?: number
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

export type BrowserNetworkRequestListResponse = OkResult & {
  requests: BrowserNetworkRequestRecord[]
}

export type BrowserNetworkRequestResponse = OkResult & {
  request?: BrowserNetworkRequestRecord
}

export type DownloadStrategyAnalysis = {
  url: string
  route: BrowserNetworkDownloadRoute
  primary: 'yt-dlp' | 'browser-network'
  fallback: 'browser-network' | null
  reason: string
  ytdlp_scope: {
    supported_sites_source: 'yt-dlp supportedsites.md'
    supports_generic_extractor: boolean
    supports_embeds: boolean
    reliable_check: 'try-extractor'
    media: Array<'video' | 'audio' | 'subtitles' | 'playlists' | 'livestreams' | 'metadata'>
  }
}

export type DownloadStrategyResponse = OkResult & {
  analysis?: DownloadStrategyAnalysis
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
  root?: string
  browsable?: boolean
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

// Phase 6 PathGrant — 工作区外路径授权

export type PathGrantKind = 'file.read' | 'file.write' | 'dir.read'

export type PathGrantStatus = 'active' | 'consumed' | 'revoked' | 'expired'

export type PathGrantRecord = {
  id: string
  kind: PathGrantKind
  status: PathGrantStatus
  physicalPath: string
  displayName: string
  expiresAt: number
  createdAt: number
  updatedAt: number
  jobId?: string
}

export type PathGrantInfo = Omit<PathGrantRecord, 'physicalPath'>

export type PathGrantResponse = OkResult & { grant?: PathGrantInfo }

export type PathGrantListResponse = OkResult & { grants: PathGrantInfo[] }
