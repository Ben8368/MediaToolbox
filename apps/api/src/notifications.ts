import type { LogEntry } from '@mediatoolbox/contracts'
import type { MediaToolboxDatabase } from '@mediatoolbox/db'

export const NOTIFICATION_LEVELS = new Set(['WARNING', 'ERROR', 'CRITICAL'])
export const NOTIFICATIONS_READ_AT_KEY = 'notifications_read_at'

export function isNotificationLevel(level: string) {
  return NOTIFICATION_LEVELS.has(level)
}

export function isUnreadNotification(item: Pick<LogEntry, 'level' | 'time'>, readAt: string | null) {
  if (!isNotificationLevel(item.level)) return false
  return !readAt || item.time > readAt
}

export async function loadNotificationsReadAt(db: MediaToolboxDatabase): Promise<string | null> {
  const stored = await db.settings.get(NOTIFICATIONS_READ_AT_KEY)
  if (stored) return stored

  const logs = await db.logs.list({ limit: 1000 })
  const latestNotification = logs.find((item) => isNotificationLevel(item.level))
  if (!latestNotification) return null

  const readAt = latestNotification.time
  await db.settings.set(NOTIFICATIONS_READ_AT_KEY, readAt)
  return readAt
}

export async function persistNotificationsReadAt(db: MediaToolboxDatabase, readAt: string) {
  await db.settings.set(NOTIFICATIONS_READ_AT_KEY, readAt)
}

export function filterNotificationLogs(logs: LogEntry[]) {
  return logs.filter((item) => isNotificationLevel(item.level))
}
