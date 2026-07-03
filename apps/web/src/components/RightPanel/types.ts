export type RuntimeMetrics = {
  runtime?: { uptime_seconds?: number }
  system?: {
    cpu_percent?: number
    memory_percent?: number
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

export const EMPTY_METRICS: RuntimeMetrics = {
  runtime: { uptime_seconds: 0 },
  system: { cpu_percent: 0, memory_percent: 0, gpu_percent: 0, gpu_available: false },
  network: { upload: { text: '0 B/s' }, download: { text: '0 B/s' }, upload_bytes_per_sec: 0, download_bytes_per_sec: 0 },
  services: [],
  tasks: [],
}
