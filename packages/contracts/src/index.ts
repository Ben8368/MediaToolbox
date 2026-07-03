export type WorkbenchAppId = 'file-manager' | 'download' | 'transcode' | 'ps' | 'settings' | 'logs'

export type JobKind = 'download.video' | 'download.audio' | 'download.subtitle' | 'media.transcode' | 'psd.batch'

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
  createdAt: string
  updatedAt: string
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

export type HealthResponse = {
  ok: boolean
  service: string
  version: string
}
