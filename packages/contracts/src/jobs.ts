import type { OkResult } from './core.js'

export type JobKind =
  | 'download.video'
  | 'download.audio'
  | 'download.subtitle'
  | 'browser.download'
  | 'browser.request'
  | 'media.transcode'
  | 'psd.scan'
  | 'psd.apply'
  | 'web.render.image'
  | 'web.render.video'

export type JobStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled'

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
  /** 已开始的执行次数；任务首次进入 running 时从 0 增加到 1。 */
  attempt: number
  /** 包含首次执行在内的最大执行次数。1 表示不自动重试。 */
  maxAttempts: number
  /** 同一任务跨 attempt 保持稳定，用于隔离临时输出并实现幂等提交。 */
  outputToken: string
  /** queued 任务的最早再次执行时间（Unix 秒）。 */
  nextAttemptAt?: number
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
