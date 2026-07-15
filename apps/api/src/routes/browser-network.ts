import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type {
  BrowserNetworkDownloadListResponse,
  BrowserNetworkDownloadRecord,
  BrowserNetworkDownloadResponse,
  BrowserNetworkPermissionEvent,
  BrowserNetworkRequestListResponse,
  BrowserNetworkRequestRecord,
  BrowserNetworkRequestResponse,
  OkResult,
} from '@mediatoolbox/contracts'
import { createJobRecord, transitionJob } from '@mediatoolbox/job-core'

import { requireDesktopAuth } from '../desktop-auth.js'
import {
  browserNetworkDownloadCreateSchema,
  browserNetworkDownloadUpdateSchema,
  browserNetworkPermissionEventSchema,
  browserNetworkRequestCreateSchema,
  browserNetworkRequestUpdateSchema,
} from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog, entryName, nowSeconds } from '../utils.js'
import {
  applyBrowserRequestUpdate,
  applyDownloadUpdate,
  createBrowserDownloadId,
  createBrowserRequestId,
  hostFromUrl,
  normalizeBrowserDownloadPath,
  normalizeBrowserRequestUrl,
  safeFilename,
  syncBrowserRequestJob,
  syncDownloadJob,
  type BrowserDownloadCreateBody,
  type BrowserDownloadUpdateBody,
  type BrowserRequestCreateBody,
  type BrowserRequestUpdateBody,
} from './browser-network-model.js'

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
      const id = createBrowserDownloadId(state, request.body.id)
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
      const id = createBrowserRequestId(state, request.body.id)
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
        request_bytes: Math.max(0, Math.floor(request.body.request_bytes ?? 0)),
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
  return requireDesktopAuth(request, reply, 'x-mediatoolbox-browser-network')
}
