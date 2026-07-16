import type Database from 'better-sqlite3'
import type { JobRecord } from '@mediatoolbox/contracts'

import type { MediaToolboxDatabase } from './types.js'

type DbJobRow = {
  id: string
  kind: string
  status: string
  title: string
  progress_json: string | null
  created_at: number
  updated_at: number
  error_message: string | null
}

export function createJobRepository(db: Database.Database): MediaToolboxDatabase['jobs'] {
  const mapRow = (row: DbJobRow): JobRecord => {
    const record: JobRecord = {
      id: row.id,
      kind: row.kind as JobRecord['kind'],
      status: row.status as JobRecord['status'],
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    if (row.progress_json) record.progress = JSON.parse(row.progress_json)
    if (row.error_message !== null) record.errorMessage = row.error_message
    return record
  }

  return {
    create: async (job) => {
      db.prepare(`
        INSERT INTO jobs (id, kind, status, title, progress_json, created_at, updated_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        job.id,
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.createdAt,
        job.updatedAt,
        job.errorMessage ?? null,
      )
    },

    findById: async (id) => {
      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as DbJobRow | undefined
      return row ? mapRow(row) : undefined
    },

    list: async () => {
      const rows = db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC').all() as DbJobRow[]
      return rows.map(mapRow)
    },

    listActive: async () => {
      const rows = db.prepare(`
        SELECT * FROM jobs
        WHERE status IN ('queued', 'running', 'paused')
        ORDER BY updated_at DESC
      `).all() as DbJobRow[]
      return rows.map(mapRow)
    },

    update: async (job) => {
      db.prepare(`
        UPDATE jobs
        SET kind = ?, status = ?, title = ?, progress_json = ?, updated_at = ?, error_message = ?
        WHERE id = ?
      `).run(
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.updatedAt,
        job.errorMessage ?? null,
        job.id,
      )
    },

    updateIfStatus: async (job, expectedStatus) => {
      const result = db.prepare(`
        UPDATE jobs
        SET kind = ?, status = ?, title = ?, progress_json = ?, updated_at = ?, error_message = ?
        WHERE id = ? AND status = ?
      `).run(
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.updatedAt,
        job.errorMessage ?? null,
        job.id,
        expectedStatus,
      )
      return result.changes === 1
    },

    patchIfStatus: async (id, expectedStatus, patch, updatedAt) => {
      const result = db.prepare(`
        UPDATE jobs
        SET progress_json = COALESCE(?, progress_json),
            error_message = COALESCE(?, error_message),
            updated_at = ?
        WHERE id = ? AND status = ?
      `).run(
        patch.progress ? JSON.stringify(patch.progress) : null,
        patch.errorMessage ?? null,
        updatedAt,
        id,
        expectedStatus,
      )
      return result.changes === 1
    },

    delete: async (id) => {
      db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    },
  }
}
