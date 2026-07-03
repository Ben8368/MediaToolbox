import { apiRequest } from '@/api/http'
import type { LogListResponse, LogMetadataResponse, UnreadNotificationResponse } from '@/api/types'

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export async function fetchLogs(query: { level?: string; module?: string; page?: number; page_size?: number } = {}) {
  return apiRequest<LogListResponse>(`/api/logs${buildQuery(query)}`)
}

export async function fetchLogMetadata() {
  return apiRequest<LogMetadataResponse>('/api/logs/metadata')
}

export async function clearLogs() {
  return apiRequest<{ ok: boolean }>('/api/logs', { method: 'DELETE' })
}

export async function getUnreadNotificationCount() {
  return apiRequest<UnreadNotificationResponse>('/api/notifications/unread-count')
}

export async function clearNotifications() {
  return apiRequest<{ ok: boolean }>('/api/notifications', { method: 'DELETE' })
}

export async function markAllNotificationsAsRead() {
  return apiRequest<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' })
}
