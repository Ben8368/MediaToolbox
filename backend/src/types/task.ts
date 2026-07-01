/** 任务状态，与前端 DownloadTaskStatus 对齐 */
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'partial'

/** 后端任务实体（完整），序列化到 JSON 存储 */
export interface Task {
  id: string
  type: string
  name: string
  title?: string
  source_url?: string
  status: TaskStatus
  progress: number        // 0-100
  stage: string           // 'pending' | 'downloading' | 'transcoding' | 'done' | ...
  created_at: number      // Unix ms
  updated_at: number | null
  started_at: number | null
  completed_at: number | null
  paused_at: number | null
  params?: Record<string, unknown>
  state?: Record<string, unknown>
  result?: Record<string, unknown>
  output_files?: string[]
  error?: string
}

/** POST /api/fetch/tasks 请求体 */
export interface SubmitFetchBody {
  urls: string[]
  output_dir?: string
  write_subs?: boolean
  write_auto_subs?: boolean
  sub_langs?: string
  // 下载选项
  prefer_h264?: boolean
  no_transcode?: boolean
  subtitle_format?: 'srt' | 'vtt'
  max_concurrent?: number
  cookies_from_browser?: string
}
