import type { FastifyInstance } from 'fastify'
import type { LogListResponse, LogMetadataResponse, OkResult, UnreadNotificationResponse } from '@mediatoolbox/contracts'

import {
  filterNotificationLogs,
  isUnreadNotification,
  loadNotificationsReadAt,
  persistNotificationsReadAt,
} from '../notifications.js'
import type { ApiState } from '../state.js'
import { formatLogTime } from '../utils.js'

const LOG_LEVELS = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL']

async function markNotificationsRead(state: ApiState) {
  const readAt = formatLogTime()
  state.notificationsReadAt = readAt
  await persistNotificationsReadAt(state.db, readAt)
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
    await markNotificationsRead(state)
    return { ok: true }
  })

  app.get<{ Querystring: { level?: string; page?: number; page_size?: number; unread_only?: string }; Reply: LogListResponse }>('/api/notifications', async (request) => {
    const page = Math.max(1, Number(request.query.page || 1))
    const pageSize = Math.max(1, Number(request.query.page_size || 50))
    const unreadOnly = request.query.unread_only === '1' || request.query.unread_only === 'true'
    const all = filterNotificationLogs(await state.db.logs.list({ limit: 10000 }))
      .filter((item) => !request.query.level || item.level === request.query.level)
    const filtered = unreadOnly
      ? all.filter((item) => isUnreadNotification(item, state.notificationsReadAt))
      : all
    return {
      ok: true,
      total: filtered.length,
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      page_size: pageSize,
      levels: ['WARNING', 'ERROR', 'CRITICAL'],
    }
  })

  app.get<{ Reply: UnreadNotificationResponse }>('/api/notifications/unread-count', async () => {
    const logs = filterNotificationLogs(await state.db.logs.list({ limit: 1000 }))
    return {
      ok: true,
      unread_count: logs.filter((item) => isUnreadNotification(item, state.notificationsReadAt)).length,
    }
  })

  app.delete<{ Reply: OkResult }>('/api/notifications', async () => {
    await markNotificationsRead(state)
    return { ok: true }
  })

  app.post<{ Reply: OkResult }>('/api/notifications/read-all', async () => {
    await markNotificationsRead(state)
    return { ok: true }
  })
}

export async function hydrateNotificationState(state: ApiState) {
  state.notificationsReadAt = await loadNotificationsReadAt(state.db)
}
