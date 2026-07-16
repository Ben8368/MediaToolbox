import type { OkResult } from './core.js'

export type FetchTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'partial'

export type DownloadCookieBrowser = 'chrome' | 'edge' | 'safari' | 'firefox'

export type FetchTaskDraft = {
  url?: string
  urls?: string[]
  mode?: 'video' | 'audio' | 'subtitles'
  output_dir?: string
  /** 下载最高规格；启用时在下载完成后转为 H.264/MP4，便于在常见设备播放。 */
  compatible_format?: boolean
  max_concurrent?: number
  cookies_from_browser?: DownloadCookieBrowser
}

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
