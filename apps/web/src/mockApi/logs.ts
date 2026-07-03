import { delay, nowSeconds } from './shared'

export type LogEntry = {
  level: string
  module: string
  time: string
  user: string
  event: string
  message: string
}

export const logs: LogEntry[] = []

function formatLogTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export function addLog(level: string, module: string, event: string) {
  logs.unshift({
    level,
    module,
    time: formatLogTime(),
    user: 'demo',
    event,
    message: event,
  })
}

export async function fetchLogs(query: { level?: string; module?: string; page?: number; page_size?: number } = {}) {
  await delay(120)
  const level = String(query.level || '')
  const moduleName = String(query.module || '')
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.max(1, Number(query.page_size || 50))
  const baseLogs = logs.length ? logs : [
    { level: 'NOTICE', module: 'system', time: formatLogTime(), user: 'demo', event: 'Frontend Lite Demo 已启动', message: 'Frontend Lite Demo 已启动' },
    { level: 'INFO', module: 'file-manager', time: formatLogTime(), user: 'demo', event: '模拟工作区已挂载：/Workspace', message: '模拟工作区已挂载：/Workspace' },
  ]
  const filtered = baseLogs
    .filter((item) => !level || item.level === level)
    .filter((item) => !moduleName || item.module === moduleName)
  const start = (page - 1) * pageSize
  return {
    ok: true,
    total: filtered.length,
    items: filtered.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    levels: ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL'],
  }
}

export async function fetchLogMetadata() {
  return { ok: true, modules: ['system', 'downloader', 'file-manager'] }
}

export async function clearLogs() {
  logs.length = 0
  return { ok: true, cleared: 0 }
}

export async function getUnreadNotificationCount() {
  const unread_count = logs.filter((item) => item.level === 'WARNING' || item.level === 'ERROR').length
  return { ok: true, unread_count }
}

export async function fetchNotifications() {
  return { ok: true, total: 0, items: [] }
}

export async function markNotificationAsRead() {
  return { ok: true, unread_count: 0 }
}

export async function markAllNotificationsAsRead() {
  return { ok: true, unread_count: 0 }
}

export async function clearNotifications() {
  return { ok: true, unread_count: 0, cleared: 0 }
}
