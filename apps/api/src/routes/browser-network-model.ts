import path from 'node:path'
import type {
  BrowserNetworkDownloadRecord,
  BrowserNetworkDownloadStatus,
  BrowserNetworkHttpMethod,
  BrowserNetworkRequestRecord,
  BrowserNetworkRequestStatus,
  JobRecord,
} from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'
import { patchRunningJob, updateJobRecord } from '../job-utils.js'
import { addLog, nowSeconds } from '../utils.js'
import { normalizeWorkspacePath } from '../workspace-path.js'

export type BrowserDownloadCreateBody = {
  id?: string
  source_url: string
  url_chain?: string[]
  filename: string
  target_path: string
  view_id: string
  session_id: string
  total_bytes?: number
  mime_type?: string
  user_gesture?: boolean
}

export type BrowserDownloadUpdateBody = {
  status?: BrowserNetworkDownloadStatus
  received_bytes?: number
  total_bytes?: number
  error?: string
}

export type BrowserRequestCreateBody = {
  id?: string
  url: string
  method: BrowserNetworkHttpMethod
  view_id: string
  session_id: string
  request_headers?: Record<string, string>
  request_bytes?: number
}

export type BrowserRequestUpdateBody = {
  status?: BrowserNetworkRequestStatus
  response_status?: number
  response_headers?: Record<string, string>
  response_bytes?: number
  error?: string
}

export function normalizeBrowserDownloadPath(input: string, workspaceRoot: string): string {
  const targetPath = normalizeWorkspacePath(input, workspaceRoot)
  const downloadsRoot = `${workspaceRoot}/Downloads`
  if (targetPath !== downloadsRoot && !targetPath.startsWith(`${downloadsRoot}/`)) {
    const error = new Error('浏览器下载只能写入工作区 Downloads 目录。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  return targetPath
}

export function safeFilename(filename: string): string {
  const basename = path.basename(filename).replace(/[/:\\]/g, '-').trim()
  return basename || 'download.bin'
}

export function createBrowserDownloadId(state: ApiState, now: number, requestedId?: string): string {
  const id = requestedId?.trim() || `browser-download-${now}-${state.browserDownloads.length + 1}`
  validateBrowserNetworkId(id, '浏览器下载 ID 不符合 API 契约。')
  if (state.browserDownloads.some((download) => download.id === id)) {
    const error = new Error('浏览器下载记录已存在。')
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }
  return id
}

export function createBrowserRequestId(state: ApiState, now: number, requestedId?: string): string {
  const id = requestedId?.trim() || `browser-request-${now}-${state.browserRequests.length + 1}`
  validateBrowserNetworkId(id, '浏览器网络请求 ID 不符合 API 契约。')
  if (state.browserRequests.some((item) => item.id === id)) {
    const error = new Error('浏览器网络请求记录已存在。')
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }
  return id
}

export function normalizeBrowserRequestUrl(input: string): string {
  const parsed = new URL(input)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const error = new Error('浏览器网络请求仅支持 http 和 https。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  return parsed.href
}

export function hostFromUrl(input: string): string {
  try {
    return new URL(input).hostname
  } catch {
    return input
  }
}

export function applyDownloadUpdate(download: BrowserNetworkDownloadRecord, update: BrowserDownloadUpdateBody): void {
  if (typeof update.received_bytes === 'number') download.received_bytes = Math.max(0, Math.floor(update.received_bytes))
  if (typeof update.total_bytes === 'number') download.total_bytes = Math.max(0, Math.floor(update.total_bytes))
  if (update.status) download.status = update.status
  if (update.error !== undefined) download.error = update.error
  download.updated_at = nowSeconds()
  if (download.status === 'succeeded' || download.status === 'failed' || download.status === 'canceled') {
    download.completed_at = download.updated_at
  }
}

export function applyBrowserRequestUpdate(record: BrowserNetworkRequestRecord, update: BrowserRequestUpdateBody): void {
  if (update.status) record.status = update.status
  if (typeof update.response_status === 'number') record.response_status = Math.floor(update.response_status)
  if (typeof update.response_bytes === 'number') record.response_bytes = Math.max(0, Math.floor(update.response_bytes))
  if (update.response_headers) record.response_headers = update.response_headers
  if (update.error !== undefined) record.error = update.error
  record.updated_at = nowSeconds()
  if (record.status === 'succeeded' || record.status === 'failed' || record.status === 'canceled') {
    record.completed_at = record.updated_at
  }
}

export async function syncDownloadJob(state: ApiState, download: BrowserNetworkDownloadRecord): Promise<void> {
  const job = await state.db.jobs.findById(download.job_id)
  if (!job) return

  const progress = {
    current: download.received_bytes,
    total: download.total_bytes || Math.max(download.received_bytes, 1),
    unit: 'bytes' as const,
  }
  const withProgress: JobRecord = { ...job, progress }
  if (download.error) withProgress.errorMessage = download.error

  const nextStatus = toJobStatus(download.status)
  const updated = nextStatus === 'running'
    ? await patchRunningJob(state, job.id, { progress, ...(withProgress.errorMessage ? { errorMessage: withProgress.errorMessage } : {}) })
    : await updateJobRecord(state, job.id, nextStatus, { progress, ...(withProgress.errorMessage ? { errorMessage: withProgress.errorMessage } : {}) })
  if (!updated) {
    const latest = await state.db.jobs.findById(download.job_id)
    if (latest) reconcileDownloadStatus(download, latest.status)
    return
  }

  if (download.status === 'succeeded') {
    await createDownloadAsset(state, download)
    addLog(state.db, 'INFO', 'browser-network', `浏览器下载完成：${download.filename}`)
  } else if (download.status === 'failed') {
    addLog(state.db, 'ERROR', 'browser-network', `浏览器下载失败：${download.filename}`)
  } else if (download.status === 'canceled') {
    addLog(state.db, 'WARNING', 'browser-network', `浏览器下载取消：${download.filename}`)
  }
}

export async function syncBrowserRequestJob(state: ApiState, record: BrowserNetworkRequestRecord): Promise<void> {
  const job = await state.db.jobs.findById(record.job_id)
  if (!job) return

  const progress = {
    current: record.response_bytes,
    total: Math.max(record.response_bytes, 1),
    unit: 'bytes' as const,
  }
  const withProgress: JobRecord = { ...job, progress }
  if (record.error) withProgress.errorMessage = record.error

  const nextStatus = toBrowserRequestJobStatus(record.status)
  const updated = nextStatus === 'running'
    ? await patchRunningJob(state, job.id, { progress, ...(withProgress.errorMessage ? { errorMessage: withProgress.errorMessage } : {}) })
    : await updateJobRecord(state, job.id, nextStatus, { progress, ...(withProgress.errorMessage ? { errorMessage: withProgress.errorMessage } : {}) })
  if (!updated) {
    const latest = await state.db.jobs.findById(record.job_id)
    if (latest) reconcileBrowserRequestStatus(record, latest.status)
    return
  }

  if (record.status === 'succeeded') {
    addLog(state.db, 'INFO', 'browser-network', `浏览器网络请求完成：${record.method} ${record.url}`)
  } else if (record.status === 'failed') {
    addLog(state.db, 'ERROR', 'browser-network', `浏览器网络请求失败：${record.method} ${record.url}`)
  } else if (record.status === 'canceled') {
    addLog(state.db, 'WARNING', 'browser-network', `浏览器网络请求取消：${record.method} ${record.url}`)
  }
}

function reconcileDownloadStatus(download: BrowserNetworkDownloadRecord, status: JobRecord['status']): void {
  if (status === 'succeeded' || status === 'failed' || status === 'canceled') {
    download.status = status
    download.completed_at = nowSeconds()
    download.updated_at = download.completed_at
  }
}

function reconcileBrowserRequestStatus(record: BrowserNetworkRequestRecord, status: JobRecord['status']): void {
  if (status === 'succeeded' || status === 'failed' || status === 'canceled') {
    record.status = status
    record.completed_at = nowSeconds()
    record.updated_at = record.completed_at
  }
}

function validateBrowserNetworkId(id: string, message: string): void {
  if (/^[A-Za-z0-9._:-]{1,100}$/.test(id)) return
  const error = new Error(message)
  ;(error as Error & { statusCode?: number }).statusCode = 400
  throw error
}

function toJobStatus(status: BrowserNetworkDownloadStatus): JobRecord['status'] {
  if (status === 'pending') return 'queued'
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed') return 'failed'
  if (status === 'canceled') return 'canceled'
  return 'running'
}

function toBrowserRequestJobStatus(status: BrowserNetworkRequestStatus): JobRecord['status'] {
  if (status === 'pending') return 'queued'
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed') return 'failed'
  if (status === 'canceled') return 'canceled'
  return 'running'
}

async function createDownloadAsset(state: ApiState, download: BrowserNetworkDownloadRecord): Promise<void> {
  const now = new Date().toISOString()
  const asset = {
    id: `asset-${download.id}`,
    kind: assetKindFromMime(download.mime_type, download.filename),
    name: download.filename,
    path: download.target_path,
    createdAt: now,
    updatedAt: now,
  }
  const size = download.total_bytes || download.received_bytes
  if (size > 0) Object.assign(asset, { size })
  if (download.mime_type) Object.assign(asset, { mimeType: download.mime_type })
  await state.db.assets.create(asset).catch(() => undefined)
}

function assetKindFromMime(mimeType: string | undefined, filename: string): 'video' | 'audio' | 'image' | 'document' | 'other' {
  if (mimeType?.startsWith('video/')) return 'video'
  if (mimeType?.startsWith('audio/')) return 'audio'
  if (mimeType?.startsWith('image/')) return 'image'
  if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(filename)) return 'document'
  return 'other'
}
