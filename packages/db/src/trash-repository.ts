import type Database from 'better-sqlite3'
import type { TrashEntry } from '@mediatoolbox/contracts'

import type { MediaToolboxDatabase } from './index.js'

export function createTrashRepository(db: Database.Database): MediaToolboxDatabase['trash'] {
  return {
    create: async (workspaceRoot, entry) => {
      db.prepare(
        `INSERT INTO trash_entries (id, workspace_root, name, original_path, deleted_at, type, size, stored_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        entry.id,
        workspaceRoot,
        entry.name,
        entry.original_path,
        entry.deleted_at,
        entry.type,
        entry.size,
        entry.stored_path,
      )
    },

    findById: async (workspaceRoot, id) => {
      const row = db.prepare('SELECT * FROM trash_entries WHERE workspace_root = ? AND id = ?').get(workspaceRoot, id) as DbTrashRow | undefined
      return row ? mapDbTrashToRecord(row) : undefined
    },

    list: async (workspaceRoot) => {
      const rows = db.prepare('SELECT * FROM trash_entries WHERE workspace_root = ? ORDER BY deleted_at DESC').all(workspaceRoot) as DbTrashRow[]
      return rows.map(mapDbTrashToRecord)
    },

    delete: async (workspaceRoot, id) => {
      db.prepare('DELETE FROM trash_entries WHERE workspace_root = ? AND id = ?').run(workspaceRoot, id)
    },

    clear: async (workspaceRoot) => {
      db.prepare('DELETE FROM trash_entries WHERE workspace_root = ?').run(workspaceRoot)
    },
  }
}

function mapDbTrashToRecord(row: DbTrashRow): TrashEntry {
  return {
    id: row.id,
    name: row.name,
    original_path: row.original_path,
    deleted_at: row.deleted_at,
    type: row.type as TrashEntry['type'],
    size: row.size,
    stored_path: row.stored_path,
  }
}

type DbTrashRow = {
  id: string
  workspace_root: string
  name: string
  original_path: string
  deleted_at: number
  type: string
  size: number
  stored_path: string
}
