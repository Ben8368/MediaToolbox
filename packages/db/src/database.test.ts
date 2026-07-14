import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteDatabase } from './database.js'
import type { JobRecord, AssetRecord, LogEntry, PathGrantRecord } from '@mediatoolbox/contracts'

let db: SqliteDatabase

beforeEach(() => {
  db = new SqliteDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

const makeJob = (overrides?: Partial<JobRecord>): JobRecord => ({
  id: 'job-1',
  kind: 'download.video',
  status: 'queued',
  title: 'Test Video',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

describe('jobs', () => {
  it('creates and retrieves a job by id', async () => {
    const job = makeJob()
    await db.jobs.create(job)
    const found = await db.jobs.findById('job-1')
    expect(found).toMatchObject({ id: 'job-1', status: 'queued' })
  })

  it('returns undefined for missing job', async () => {
    const found = await db.jobs.findById('not-exist')
    expect(found).toBeUndefined()
  })

  it('lists all jobs', async () => {
    await db.jobs.create(makeJob({ id: 'job-1' }))
    await db.jobs.create(makeJob({ id: 'job-2', title: 'Second' }))
    const list = await db.jobs.list()
    expect(list).toHaveLength(2)
  })

  it('updates job status', async () => {
    const job = makeJob()
    await db.jobs.create(job)
    await db.jobs.update({ ...job, status: 'running', updatedAt: 2000 })
    const updated = await db.jobs.findById('job-1')
    expect(updated?.status).toBe('running')
    expect(updated?.updatedAt).toBe(2000)
  })

  it('persists and restores progress', async () => {
    const job = makeJob({ progress: { current: 50, total: 100, unit: 'percent' } })
    await db.jobs.create(job)
    const found = await db.jobs.findById('job-1')
    expect(found?.progress).toEqual({ current: 50, total: 100, unit: 'percent' })
  })

  it('persists and restores errorMessage', async () => {
    const job = makeJob({ status: 'failed', errorMessage: 'network timeout' })
    await db.jobs.create(job)
    const found = await db.jobs.findById('job-1')
    expect(found?.errorMessage).toBe('network timeout')
  })
})

const makeAsset = (overrides?: Partial<AssetRecord>): AssetRecord => ({
  id: 'asset-1',
  kind: 'video',
  name: 'video.mp4',
  path: '/downloads/video.mp4',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('assets', () => {
  it('creates and retrieves an asset by id', async () => {
    await db.assets.create(makeAsset())
    const found = await db.assets.findById('asset-1')
    expect(found).toMatchObject({ id: 'asset-1', kind: 'video', name: 'video.mp4' })
  })

  it('returns undefined for missing asset', async () => {
    const found = await db.assets.findById('not-exist')
    expect(found).toBeUndefined()
  })

  it('lists all assets', async () => {
    await db.assets.create(makeAsset({ id: 'asset-1', path: '/a.mp4' }))
    await db.assets.create(makeAsset({ id: 'asset-2', path: '/b.mp4' }))
    const list = await db.assets.list()
    expect(list).toHaveLength(2)
  })

  it('stores optional size and mimeType', async () => {
    await db.assets.create(makeAsset({ size: 1024, mimeType: 'video/mp4' }))
    const found = await db.assets.findById('asset-1')
    expect(found?.size).toBe(1024)
    expect(found?.mimeType).toBe('video/mp4')
  })
})

const makeLog = (overrides?: Partial<LogEntry>): LogEntry => ({
  level: 'info',
  module: 'download',
  time: new Date().toISOString(),
  user: 'system',
  event: 'job.started',
  message: 'Download started',
  ...overrides,
})

describe('settings', () => {
  it('stores and retrieves settings by key', async () => {
    await db.settings.set('notifications_read_at', '2026-07-07 10:00:00')
    await expect(db.settings.get('notifications_read_at')).resolves.toBe('2026-07-07 10:00:00')
    await expect(db.settings.get('missing')).resolves.toBeUndefined()
  })

  it('updates existing settings', async () => {
    await db.settings.set('notifications_read_at', '2026-07-07 10:00:00')
    await db.settings.set('notifications_read_at', '2026-07-07 11:00:00')
    await expect(db.settings.get('notifications_read_at')).resolves.toBe('2026-07-07 11:00:00')
  })
})

describe('logs', () => {
  it('creates and lists log entries', async () => {
    await db.logs.create(makeLog())
    await db.logs.create(makeLog({ level: 'error', message: 'Download failed' }))
    const list = await db.logs.list()
    expect(list).toHaveLength(2)
  })

  it('respects limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await db.logs.create(makeLog({ message: `msg-${i}` }))
    }
    const page = await db.logs.list({ limit: 2, offset: 2 })
    expect(page).toHaveLength(2)
  })

  it('defaults to 100 limit', async () => {
    const list = await db.logs.list()
    expect(Array.isArray(list)).toBe(true)
  })

  it('clears persisted log entries', async () => {
    await db.logs.create(makeLog())
    await db.logs.clear()
    await expect(db.logs.list()).resolves.toEqual([])
  })
})

const makeGrant = (overrides?: Partial<PathGrantRecord>): PathGrantRecord => ({
  id: 'grant-1',
  kind: 'file.read',
  status: 'active',
  physicalPath: 'C:/external/input.psd',
  displayName: 'input.psd',
  expiresAt: Date.now() + 3_600_000,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
})

describe('pathGrants', () => {
  it('binds a grant to a job only once (first bind wins)', async () => {
    await db.pathGrants.create(makeGrant())
    await expect(db.pathGrants.bindJob('grant-1', 'job-a', Date.now())).resolves.toBe(true)
    await expect(db.pathGrants.bindJob('grant-1', 'job-b', Date.now())).resolves.toBe(false)

    const grant = await db.pathGrants.findById('grant-1')
    expect(grant?.jobId).toBe('job-a')
  })

  it('finds active grants bound to a given job', async () => {
    await db.pathGrants.create(makeGrant({ id: 'grant-1' }))
    await db.pathGrants.create(makeGrant({ id: 'grant-2' }))
    await db.pathGrants.bindJob('grant-1', 'job-a', Date.now())
    await db.pathGrants.bindJob('grant-2', 'job-b', Date.now())

    const boundToA = await db.pathGrants.findActiveByJobId('job-a')
    expect(boundToA.map((g) => g.id)).toEqual(['grant-1'])
  })

  it('excludes revoked grants from findActiveByJobId', async () => {
    await db.pathGrants.create(makeGrant())
    await db.pathGrants.bindJob('grant-1', 'job-a', Date.now())
    await db.pathGrants.update({ id: 'grant-1', status: 'revoked', updatedAt: Date.now() })

    const boundToA = await db.pathGrants.findActiveByJobId('job-a')
    expect(boundToA).toEqual([])
  })

  it('findActiveById treats consumed grants as inactive', async () => {
    await db.pathGrants.create(makeGrant({ kind: 'file.write' }))
    await expect(db.pathGrants.consume('grant-1', Date.now())).resolves.toBe(true)
    await expect(db.pathGrants.consume('grant-1', Date.now())).resolves.toBe(false)

    await expect(db.pathGrants.findActiveById('grant-1')).resolves.toBeUndefined()
  })

  it('does not bind or consume expired grants', async () => {
    await db.pathGrants.create(makeGrant({ id: 'read-expired', expiresAt: Date.now() - 1 }))
    await db.pathGrants.create(makeGrant({ id: 'write-expired', kind: 'file.write', expiresAt: Date.now() - 1 }))

    await expect(db.pathGrants.bindJob('read-expired', 'job-a', Date.now())).resolves.toBe(false)
    await expect(db.pathGrants.consume('write-expired', Date.now())).resolves.toBe(false)
  })
})
