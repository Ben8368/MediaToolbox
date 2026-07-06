import path from 'node:path'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type {
  BrowserNetworkDownloadListResponse,
  BrowserNetworkDownloadRecord,
  BrowserNetworkDownloadResponse,
  BrowserNetworkDownloadStatus,
  BrowserNetworkHttpMethod,
  BrowserNetworkPermissionEvent,
  BrowserNetworkRequestListResponse,
  BrowserNetworkRequestRecord,
  BrowserNetworkRequestResponse,
  BrowserNetworkRequestStatus,
  JobRecord,
  OkResult,
} from '@mediatoolbox/contracts'
import { canTransitionJob, createJobRecord, transitionJob } from '@mediatoolbox/job-core'

import {
  browserNetworkDownloadCreateSchema,
  browserNetworkDownloadUpdateSchema,
  browserNetworkPermissionEventSchema,
  browserNetworkRequestCreateSchema,
  browserNetworkRequestUpdateSchema,
} from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog, entryName, nowSeconds } from '../utils.js'
import { normalizeWorkspacePath } from '../workspace-path.js'

type BrowserDownloadCreateBody = {
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

type BrowserDownloadUpdateBody = {
  status?: BrowserNetworkDownloadStatus
  received_bytes?: number
  total_bytes?: number
  error?: string
}

type BrowserRequestCreateBody = {
  id?: string
  url: string
  method: BrowserNetworkHttpMethod
  view_id: string
  session_id: string
  request_headers?: Record<string, string>
}

type BrowserRequestUpdateBody = {
  status?: BrowserNetworkRequestStatus
  response_status?: number
  response_headers?: Record<string, string>
  response_bytes?: number
  error?: string
}

const DESKTOP_MARKER = 'desktop'

export function registerBrowserNetworkRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Reply: BrowserNetworkDownloadListResponse }>('/api/browser-network/downloads', async () => ({
    ok: true,
    downloads: state.browserDownloads,
  }))

  app.get<{ Params: { id: string }; Reply: BrowserNetworkDownloadResponse }>('/api/browser-network/downloads/:id', async (request) => {
    const download = state.browserDownloads.find((item) => item.id === request.params.id)
    return download ? { ok: true, download } : { ok: false, message: '浏览器下载记录不存在。' }
  })

  app.post<{ Body: BrowserDownloadCreateBody; Reply: BrowserNetworkDownloadResponse }>(
    '/api/browser-network/downloads',
    { schema: browserNetworkDownloadCreateSchema },
    async (request, reply) => {
      if (!requireDesktopMarker(request, reply)) return { ok: false, message: '缺少桌面浏览器网络标记。' }

      const targetPath = normalizeBrowserDownloadPath(request.body.target_path, state.workspaceRoot)
      const now = nowSeconds()
      const id = createBrowserDownloadId(state, now, request.body.id)
      const download: BrowserNetworkDownloadRecord = {
        id,
        job_id: id,
        view_id: request.body.view_id,
        session_id: request.body.session_id,
        source_url: request.body.source_url,
        url_chain: request.body.url_chain ?? [request.body.source_url],
        filename: safeFilename(request.body.filename || entryName(targetPath)),
        target_path: targetPath,
        status: 'running',
        received_bytes: 0,
        total_bytes: request.body.total_bytes ?? 0,
        user_gesture: Boolean(request.body.user_gesture),
        created_at: now,
        updated_at: now,
        completed_at: null,
        error: null,
      }
      if (request.body.mime_type) download.mime_type = request.body.mime_type

      state.browserDownloads.unshift(download)
      const job = createJobRecord({ id, kind: 'browser.download', title: `浏览器下载：${download.filename}` })
      await state.db.jobs.create(transitionJob(job, 'running', new Date(now * 1000)))
      addLog(state.db, 'NOTICE', 'browser-network', `浏览器下载开始：${download.filename}`)
      return { ok: true, download }
    },
  )

  app.patch<{ Params: { id: string }; Body: BrowserDownloadUpdateBody; Reply: BrowserNetworkDownloadResponse }>(
    '/api/browser-network/downloads/:id',
    { schema: browserNetworkDownloadUpdateSchema },
    async (request, reply) => {
      if (!requireDesktopMarker(request, reply)) return { ok: false, message: '缺少桌面浏览器网络标记。' }

      const download = state.browserDownloads.find((item) => item.id === request.params.id)
      if (!download) {
        reply.status(404)
        return { ok: false, message: '浏览器下载记录不存在。' }
      }

      applyDownloadUpdate(download, request.body)
      await syncDownloadJob(state, download)
      return { ok: true, download }
    },
  )

  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/browser-network/downloads/:id/cancel', async (request, reply) => {
    if (!requireDesktopMarker(request, reply)) return { ok: false, message: '缺少桌面浏览器网络标记。' }

    const download = state.browserDownloads.find((item) => item.id === request.params.id)
    if (!download) {
      reply.status(404)
      return { ok: false, message: '浏览器下载记录不存在。' }
    }

    applyDownloadUpdate(download, { status: 'canceled', error: '桌面端取消浏览器下载。' })
    await syncDownloadJob(state, download)
    return { ok: true }
  })

  app.post<{ Body: BrowserNetworkPermissionEvent; Reply: OkResult }>(
    '/api/browser-network/permission-events',
    { schema: browserNetworkPermissionEventSchema },
    async (request, reply) => {
      if (!requireDesktopMarker(request, reply)) return { ok: false, message: '缺少桌面浏览器网络标记。' }

      const event = request.body
      const level = event.decision === 'granted' ? 'NOTICE' : 'WARNING'
      addLog(
        state.db,
        level,
        'browser-network',
        `浏览器权限${event.decision === 'granted' ? '允许' : '拒绝'}：${event.permission} @ ${event.origin}`,
      )
      return { ok: true }
    },
  )

  app.get<{ Reply: BrowserNetworkRequestListResponse }>('/api/browser-network/requests', async () => ({
    ok: true,
    requests: state.browserRequests,
  }))

  app.get<{ Params: { id: string }; Reply: BrowserNetworkRequestResponse }>('/api/browser-network/requests/:id', async (request) => {
    const browserRequest = state.browserRequests.find((item) => item.id === request.params.id)
    return browserRequest ? { ok: true, request: browserRequest } : { ok: false, message: '浏览器网络请求记录不存在。' }
  })

  app.post<{ Body: BrowserRequestCreateBody; Reply: BrowserNetworkRequestResponse }>(
    '/api/browser-network/requests',
    { schema: browserNetworkRequestCreateSchema },
    async (request, reply) => {
      if (!requireDesktopMarker(request, reply)) return { ok: false, message: '缺少桌面浏览器网络标记。' }

      const now = nowSeconds()
      const id = createBrowserRequestId(state, now, request.body.id)
      const record: BrowserNetworkRequestRecord = {
        id,
        job_id: id,
        view_id: request.body.view_id,
        session_id: request.body.session_id,
        mode: 'browser-session',
        method: request.body.method,
        url: normalizeBrowserRequestUrl(request.body.url),
        status: 'running',
        request_headers: request.body.request_headers ?? {},
        response_bytes: 0,
        created_at: now,
        updated_at: now,
        completed_at: null,
        error: null,
      }

      state.browserRequests.unshift(record)
      const job = createJobRecord({ id, kind: 'browser.request', title: `浏览器网络请求：${record.method} ${hostFromUrl(record.url)}` })
      await state.db.jobs.create(transitionJob(job, 'running', new Date(now * 1000)))
      addLog(state.db, 'NOTICE', 'browser-network', `浏览器网络请求开始：${record.method} ${record.url}`)
      return { ok: true, request: record }
    },
  )

  app.patch<{ Params: { id: string }; Body: BrowserRequestUpdateBody; Reply: BrowserNetworkRequestResponse }>(
    '/api/browser-network/requests/:id',
    { schema: browserNetworkRequestUpdateSchema },
    async (request, reply) => {
      if (!requireDesktopMarker(request, reply)) return { ok: false, message: '缺少桌面浏览器网络标记。' }

      const browserRequest = state.browserRequests.find((item) => item.id === request.params.id)
      if (!browserRequest) {
        reply.status(404)
        return { ok: false, message: '浏览器网络请求记录不存在。' }
      }

      applyBrowserRequestUpdate(browserRequest, request.body)
      await syncBrowserRequestJob(state, browserRequest)
      return { ok: true, request: browserRequest }
    },
  )
}

function requireDesktopMarker(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.headers['x-mediatoolbox-browser-network'] === DESKTOP_MARKER) return true
  reply.status(403)
  return false
}

function normalizeBrowserDownloadPath(input: string, workspaceRoot: string): string {
  const targetPath = normalizeWorkspacePath(input, workspaceRoot)
  const downloadsRoot = `${workspaceRoot}/Downloads`
  if (targetPath !== downloadsRoot && !targetPath.startsWith(`${downloadsRoot}/`)) {
    const error = new Error('浏览器下载只能写入工作区 Downloads 目录。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  return targetPath
}

function safeFilename(filename: string): string {
  const basename = path.basename(filename).replace(/[/:\\]/g, '-').trim()
  return basename || 'download.bin'
}

function createBrowserDownloadId(state: ApiState, now: number, requestedId?: string): string {
  const id = requestedId?.trim() || `browser-download-${now}-${state.browserDownloads.length + 1}`
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(id)) {
    const error = new Error('浏览器下载 ID 不符合 API 契约。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  if (state.browserDownloads.some((download) => download.id === id)) {
    const error = new Error('浏览器下载记录已存在。')
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }
  return id
}

function createBrowserRequestId(state: ApiState, now: number, requestedId?: string): string {
  const id = requestedId?.trim() || `browser-request-${now}-${state.browserRequests.length + 1}`
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(id)) {
    const error = new Error('浏览器网络请求 ID 不符合 API 契约。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  if (state.browserRequests.some((item) => item.id === id)) {
    const error = new Error('浏览器网络请求记录已存在。')
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }
  return id
}

function normalizeBrowserRequestUrl(input: string): string {
  const parsed = new URL(input)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const error = new Error('浏览器网络请求仅支持 http 和 https。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  return parsed.href
}

function hostFromUrl(input: string): string {
  try {
    return new URL(input).hostname
  } catch {
    return input
  }
}

function applyDownloadUpdate(download: BrowserNetworkDownloadRecord, update: BrowserDownloadUpdateBody): void {
  if (typeof update.received_bytes === 'number') download.received_bytes = Math.max(0, Math.floor(update.received_bytes))
  if (typeof update.total_bytes === 'number') download.total_bytes = Math.max(0, Math.floor(update.total_bytes))
  if (update.status) download.status = update.status
  if (update.error !== undefined) download.error = update.error
  download.updated_at = nowSeconds()
  if (download.status === 'succeeded' || download.status === 'failed' || download.status === 'canceled') {
    download.completed_at = download.updated_at
  }
}

function applyBrowserRequestUpdate(record: BrowserNetworkRequestRecord, update: BrowserRequestUpdateBody): void {
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

async function syncDownloadJob(state: ApiState, download: BrowserNetworkDownloadRecord): Promise<void> {
  const job = await state.db.jobs.findById(download.job_id)
  if (!job) return

  const withProgress: JobRecord = {
    ...job,
    progress: {
      current: download.received_bytes,
      total: download.total_bytes || Math.max(download.received_bytes, 1),
      unit: 'bytes',
    },
  }
  if (download.error) withProgress.errorMessage = download.error

  const nextStatus = toJobStatus(download.status)
  const updated = canTransitionJob(withProgress.status, nextStatus)
    ? transitionJob(withProgress, nextStatus)
    : withProgress
  await state.db.jobs.update(updated)

  if (download.status === 'succeeded') {
    await createDownloadAsset(state, download)
    addLog(state.db, 'INFO', 'browser-network', `浏览器下载完成：${download.filename}`)
  } else if (download.status === 'failed') {
    addLog(state.db, 'ERROR', 'browser-network', `浏览器下载失败：${download.filename}`)
  } else if (download.status === 'canceled') {
    addLog(state.db, 'WARNING', 'browser-network', `浏览器下载取消：${download.filename}`)
  }
}

async function syncBrowserRequestJob(state: ApiState, record: BrowserNetworkRequestRecord): Promise<void> {
  const job = await state.db.jobs.findById(record.job_id)
  if (!job) return

  const withProgress: JobRecord = {
    ...job,
    progress: {
      current: record.response_bytes,
      total: Math.max(record.response_bytes, 1),
      unit: 'bytes',
    },
  }
  if (record.error) withProgress.errorMessage = record.error

  const nextStatus = toBrowserRequestJobStatus(record.status)
  const updated = canTransitionJob(withProgress.status, nextStatus)
    ? transitionJob(withProgress, nextStatus)
    : withProgress
  await state.db.jobs.update(updated)

  if (record.status === 'succeeded') {
    addLog(state.db, 'INFO', 'browser-network', `浏览器网络请求完成：${record.method} ${record.url}`)
  } else if (record.status === 'failed') {
    addLog(state.db, 'ERROR', 'browser-network', `浏览器网络请求失败：${record.method} ${record.url}`)
  } else if (record.status === 'canceled') {
    addLog(state.db, 'WARNING', 'browser-network', `浏览器网络请求取消：${record.method} ${record.url}`)
  }
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
