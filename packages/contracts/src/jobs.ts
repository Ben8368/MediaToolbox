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
