import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteDatabase } from '@mediatoolbox/db'

import {
  isUnreadNotification,
  loadNotificationsReadAt,
  persistNotificationsReadAt,
} from './notifications.js'

let db: SqliteDatabase

beforeEach(() => {
  db = new SqliteDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

describe('notification read state', () => {
  it('marks existing warning logs as read on first hydration', async () => {
    await db.logs.create({
      level: 'WARNING',
      module: 'jobs',
      time: '2026-07-07 09:00:00',
      user: 'api',
      event: '取消任务：demo',
      message: '取消任务：demo',
    })

    const readAt = await loadNotificationsReadAt(db)
    expect(readAt).toBe('2026-07-07 09:00:00')
    expect(isUnreadNotification({ level: 'WARNING', time: '2026-07-07 09:00:00' }, readAt)).toBe(false)
  })

  it('persists read state in settings', async () => {
    await persistNotificationsReadAt(db, '2026-07-07 10:00:00')
    await expect(loadNotificationsReadAt(db)).resolves.toBe('2026-07-07 10:00:00')
  })

  it('treats newer warning logs as unread', async () => {
    await persistNotificationsReadAt(db, '2026-07-07 10:00:00')
    expect(isUnreadNotification({ level: 'WARNING', time: '2026-07-07 11:00:00' }, '2026-07-07 10:00:00')).toBe(true)
    expect(isUnreadNotification({ level: 'INFO', time: '2026-07-07 11:00:00' }, '2026-07-07 10:00:00')).toBe(false)
  })
})
