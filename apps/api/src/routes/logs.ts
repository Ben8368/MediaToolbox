import type { FastifyInstance } from 'fastify'
import type { LogListResponse, LogMetadataResponse, OkResult, UnreadNotificationResponse } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'

export function registerLogRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Querystring: { level?: string; module?: string; page?: number; page_size?: number }; Reply: LogListResponse }>('/api/logs', async (request) => {
    const page = Math.max(1, Number(request.query.page || 1))
    const pageSize = Math.max(1, Number(request.query.page_size || 50))
    const all = await state.db.logs.list({ limit: 10000 })
    const filtered = all
      .filter((item) => !request.query.level || item.level === request.query.level)
      .filter((item) => !request.query.module || item.module === request.query.module)
    return { ok: true, total: filtered.length, items: filtered.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, levels: ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL'] }
  })

  app.get<{ Reply: LogMetadataResponse }>('/api/logs/metadata', async () => ({ ok: true, modules: ['system', 'downloader', 'file-manager'] }))
  app.delete<{ Reply: OkResult }>('/api/logs', async () => ({ ok: true }))

  app.get<{ Reply: UnreadNotificationResponse }>('/api/notifications/unread-count', async () => {
    const logs = await state.db.logs.list({ limit: 1000 })
    return { ok: true, unread_count: logs.filter((item) => item.level === 'WARNING' || item.level === 'ERROR').length }
  })
  app.delete<{ Reply: OkResult }>('/api/notifications', async () => ({ ok: true }))
  app.post<{ Reply: OkResult }>('/api/notifications/read-all', async () => ({ ok: true }))
}
