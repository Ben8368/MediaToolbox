import path from 'node:path'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type {
  BrowserNetworkDownloadListResponse,
  BrowserNetworkDownloadRecord,
  BrowserNetworkDownloadResponse,
  BrowserNetworkDownloadStatus,
  BrowserNetworkPermissionEvent,
  JobRecord,
  OkResult,
} from '@mediatoolbox/contracts'
import { canTransitionJob, createJobRecord, transitionJob } from '@mediatoolbox/job-core'

import {
  browserNetworkDownloadCreateSchema,
  browserNetworkDownloadUpdateSchema,
  browserNetworkPermissionEventSchema,
} from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog, entryName, nowSeconds } from '../utils.js'
import { normalizeWorkspacePath } from '../workspace-path.js'

type BrowserDownloadCreateBody = {
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
      const id = createBrowserDownloadId(state, now)
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

function createBrowserDownloadId(state: ApiState, now: number): string {
  return `browser-download-${now}-${state.browserDownloads.length + 1}`
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

function toJobStatus(status: BrowserNetworkDownloadStatus): JobRecord['status'] {
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
