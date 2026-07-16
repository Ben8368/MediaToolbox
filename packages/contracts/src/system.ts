import type { OkResult } from './core.js'

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

export type RuntimeMetricsSlice = Pick<RuntimeMetrics, 'runtime' | 'network'>

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
