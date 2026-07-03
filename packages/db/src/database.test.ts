import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteDatabase } from './database.js'
import type { JobRecord, AssetRecord, LogEntry } from '@mediatoolbox/contracts'

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
