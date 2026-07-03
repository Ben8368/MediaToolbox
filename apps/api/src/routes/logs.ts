import type { FastifyInstance } from 'fastify'
import type { LogListResponse, LogMetadataResponse, OkResult, UnreadNotificationResponse } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'
import { formatLogTime } from '../utils.js'

const LOG_LEVELS = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL']
const NOTIFICATION_LEVELS = new Set(['WARNING', 'ERROR', 'CRITICAL'])

function isUnreadNotification(item: { level: string; time: string }, readAt: string | null) {
  if (!NOTIFICATION_LEVELS.has(item.level)) return false
  return !readAt || item.time > readAt
}

export function registerLogRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Querystring: { level?: string; module?: string; page?: number; page_size?: number }; Reply: LogListResponse }>('/api/logs', async (request) => {
    const page = Math.max(1, Number(request.query.page || 1))
    const pageSize = Math.max(1, Number(request.query.page_size || 50))
    const all = await state.db.logs.list({ limit: 10000 })
    const filtered = all
      .filter((item) => !request.query.level || item.level === request.query.level)
      .filter((item) => !request.query.module || item.module === request.query.module)
    return { ok: true, total: filtered.length, items: filtered.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, levels: LOG_LEVELS }
  })

  app.get<{ Reply: LogMetadataResponse }>('/api/logs/metadata', async () => {
    const logs = await state.db.logs.list({ limit: 10000 })
    const modules = [...new Set(logs.map((item) => item.module))].sort()
    return { ok: true, modules }
  })
  app.delete<{ Reply: OkResult }>('/api/logs', async () => {
    await state.db.logs.clear()
    state.notificationsReadAt = formatLogTime()
    return { ok: true }
  })

  app.get<{ Reply: UnreadNotificationResponse }>('/api/notifications/unread-count', async () => {
    const logs = await state.db.logs.list({ limit: 1000 })
    return { ok: true, unread_count: logs.filter((item) => isUnreadNotification(item, state.notificationsReadAt)).length }
  })
  app.delete<{ Reply: OkResult }>('/api/notifications', async () => {
    state.notificationsReadAt = formatLogTime()
    return { ok: true }
  })
  app.post<{ Reply: OkResult }>('/api/notifications/read-all', async () => {
    state.notificationsReadAt = formatLogTime()
    return { ok: true }
  })
}
