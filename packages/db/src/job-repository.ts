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
  attempt: number
  max_attempts: number
  output_token: string | null
  next_attempt_at: number | null
}

type DbJobExecutionRow = {
  job_id: string
  executor: string
  payload_json: string
  created_at: number
  updated_at: number
}

export function createJobRepository(db: Database.Database): MediaToolboxDatabase['jobs'] {
  const mapRow = (row: DbJobRow): JobRecord => {
    const record: JobRecord = {
      id: row.id,
      kind: row.kind as JobRecord['kind'],
      status: row.status as JobRecord['status'],
      title: row.title,
      attempt: row.attempt,
      maxAttempts: row.max_attempts,
      outputToken: row.output_token || row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    if (row.next_attempt_at !== null) record.nextAttemptAt = row.next_attempt_at
    if (row.progress_json) record.progress = JSON.parse(row.progress_json)
    if (row.error_message !== null) record.errorMessage = row.error_message
    return record
  }

  return {
    create: async (job, execution) => {
      const insert = db.transaction(() => {
        db.prepare(`
          INSERT INTO jobs (id, kind, status, title, progress_json, created_at, updated_at, error_message, attempt, max_attempts, output_token, next_attempt_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          job.id,
          job.kind,
          job.status,
          job.title,
          job.progress ? JSON.stringify(job.progress) : null,
          job.createdAt,
          job.updatedAt,
          job.errorMessage ?? null,
          job.attempt,
          job.maxAttempts,
          job.outputToken,
          job.nextAttemptAt ?? null,
        )
        if (execution) {
          db.prepare(`
            INSERT INTO job_executions (job_id, executor, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(job.id, execution.executor, JSON.stringify(execution.payload), job.createdAt, job.updatedAt)
        }
      })
      insert()
    },

    findById: async (id) => {
      const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as DbJobRow | undefined
      return row ? mapRow(row) : undefined
    },

    findExecutionByJobId: async (id) => {
      const row = db.prepare('SELECT * FROM job_executions WHERE job_id = ?').get(id) as DbJobExecutionRow | undefined
      if (!row) return undefined
      let payload: unknown
      try {
        payload = JSON.parse(row.payload_json) as unknown
      } catch {
        payload = undefined
      }
      return {
        jobId: row.job_id,
        executor: row.executor,
        payload,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
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
        SET kind = ?, status = ?, title = ?, progress_json = ?, updated_at = ?, error_message = ?,
            attempt = ?, max_attempts = ?, output_token = ?, next_attempt_at = ?
        WHERE id = ?
      `).run(
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.updatedAt,
        job.errorMessage ?? null,
        job.attempt,
        job.maxAttempts,
        job.outputToken,
        job.nextAttemptAt ?? null,
        job.id,
      )
    },

    updateIfStatus: async (job, expectedStatus) => {
      const result = db.prepare(`
        UPDATE jobs
        SET kind = ?, status = ?, title = ?, progress_json = ?, updated_at = ?, error_message = ?,
            attempt = ?, max_attempts = ?, output_token = ?, next_attempt_at = ?
        WHERE id = ? AND status = ?
      `).run(
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.updatedAt,
        job.errorMessage ?? null,
        job.attempt,
        job.maxAttempts,
        job.outputToken,
        job.nextAttemptAt ?? null,
        job.id,
        expectedStatus,
      )
      return result.changes === 1
    },

    completeWithAsset: async (job, expectedStatus, asset) => {
      const complete = db.transaction(() => {
        const result = db.prepare(`
          UPDATE jobs
          SET kind = ?, status = ?, title = ?, progress_json = ?, updated_at = ?, error_message = ?,
              attempt = ?, max_attempts = ?, output_token = ?, next_attempt_at = ?
          WHERE id = ? AND status = ?
        `).run(
          job.kind,
          job.status,
          job.title,
          job.progress ? JSON.stringify(job.progress) : null,
          job.updatedAt,
          job.errorMessage ?? null,
          job.attempt,
          job.maxAttempts,
          job.outputToken,
          job.nextAttemptAt ?? null,
          job.id,
          expectedStatus,
        )
        if (result.changes !== 1) return false
        db.prepare(`
          INSERT INTO assets (id, kind, name, path, size, mime_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind,
            name = excluded.name,
            path = excluded.path,
            size = excluded.size,
            mime_type = excluded.mime_type,
            updated_at = excluded.updated_at
        `).run(
          asset.id,
          asset.kind,
          asset.name,
          asset.path,
          asset.size ?? null,
          asset.mimeType ?? null,
          asset.createdAt,
          asset.updatedAt,
        )
        return true
      })
      return complete()
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
