import type Database from 'better-sqlite3'
import type { PathGrantRecord } from '@mediatoolbox/contracts'

import type { MediaToolboxDatabase } from './index.js'

export function createPathGrantRepository(db: Database.Database): MediaToolboxDatabase['pathGrants'] {
  return {
    create: async (grant) => {
      db.prepare(
        `INSERT INTO path_grants (id, kind, status, physical_path, display_name, expires_at, created_at, updated_at, job_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        grant.id,
        grant.kind,
        grant.status,
        grant.physicalPath,
        grant.displayName,
        grant.expiresAt,
        grant.createdAt,
        grant.updatedAt,
        grant.jobId ?? null,
      )
    },

    findById: async (id) => {
      const row = db.prepare('SELECT * FROM path_grants WHERE id = ?').get(id) as DbPathGrantRow | undefined
      return row ? mapDbGrantToRecord(row) : undefined
    },

    findActiveById: async (id) => {
      const row = db.prepare('SELECT * FROM path_grants WHERE id = ?').get(id) as DbPathGrantRow | undefined
      if (!row || row.status !== 'active') return undefined
      if (row.expires_at <= Date.now()) {
        db.prepare(`UPDATE path_grants SET status = 'expired', updated_at = ? WHERE id = ?`).run(Date.now(), id)
        return undefined
      }
      return mapDbGrantToRecord(row)
    },

    update: async ({ id, status, updatedAt }) => {
      db.prepare('UPDATE path_grants SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id)
    },

    bindJob: async (id, jobId, updatedAt) => {
      const result = db.prepare(`
        UPDATE path_grants
        SET job_id = ?, updated_at = ?
        WHERE id = ? AND job_id IS NULL AND status = 'active' AND expires_at > ?
      `).run(jobId, updatedAt, id, updatedAt)
      return result.changes === 1
    },

    consume: async (id, updatedAt) => {
      const result = db.prepare(`
        UPDATE path_grants
        SET status = 'consumed', updated_at = ?
        WHERE id = ? AND status = 'active' AND expires_at > ?
      `).run(updatedAt, id, updatedAt)
      return result.changes === 1
    },

    findActiveByJobId: async (jobId) => {
      const rows = db.prepare(`SELECT * FROM path_grants WHERE job_id = ? AND status = 'active'`).all(jobId) as DbPathGrantRow[]
      return rows.map(mapDbGrantToRecord)
    },

    listActive: async () => {
      const rows = db.prepare(`SELECT * FROM path_grants WHERE status = 'active' ORDER BY created_at DESC`).all() as DbPathGrantRow[]
      return rows.map(mapDbGrantToRecord)
    },

    deleteExpired: async () => {
      const cutoff = Date.now() - 86_400_000
      return db.prepare(`DELETE FROM path_grants WHERE expires_at < ? AND status != 'active'`).run(cutoff).changes
    },
  }
}

function mapDbGrantToRecord(row: DbPathGrantRow): PathGrantRecord {
  return {
    id: row.id,
    kind: row.kind as PathGrantRecord['kind'],
    status: row.status as PathGrantRecord['status'],
    physicalPath: row.physical_path,
    displayName: row.display_name,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.job_id !== null ? { jobId: row.job_id } : {}),
  }
}

type DbPathGrantRow = {
  id: string
  kind: string
  status: string
  physical_path: string
  display_name: string
  expires_at: number
  created_at: number
  updated_at: number
  job_id: string | null
}
