import Database from 'better-sqlite3'
import type { AssetRecord, JobRecord, LogEntry } from '@mediatoolbox/contracts'
import { CURRENT_SCHEMA_VERSION, SCHEMA_V1, SCHEMA_V2_SETTINGS } from './schema.js'
import type { MediaToolboxDatabase } from './index.js'

export class SqliteDatabase implements MediaToolboxDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initializeSchema()
  }

  private initializeSchema(): void {
    let currentVersion = this.getCurrentSchemaVersion()

    if (currentVersion === 0) {
      this.db.exec(SCHEMA_V1)
      this.recordSchemaVersion(1)
      currentVersion = 1
    }

    if (currentVersion < 2) {
      this.db.exec(SCHEMA_V2_SETTINGS)
      this.recordSchemaVersion(2)
    }
  }

  private recordSchemaVersion(version: number): void {
    this.db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      version,
      new Date().toISOString(),
    )
  }

  private getCurrentSchemaVersion(): number {
    try {
      const row = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get() as
        | { version: number | null }
        | undefined
      return row?.version ?? 0
    } catch {
      return 0
    }
  }

  close(): void {
    this.db.close()
  }

  jobs = {
    create: async (job: JobRecord): Promise<void> => {
      const stmt = this.db.prepare(`
        INSERT INTO jobs (id, kind, status, title, progress_json, created_at, updated_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        job.id,
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.createdAt,
        job.updatedAt,
        job.errorMessage ?? null
      )
    },

    findById: async (id: string): Promise<JobRecord | undefined> => {
      const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?')
      const row = stmt.get(id) as DbJobRow | undefined
      return row ? this.mapDbJobToRecord(row) : undefined
    },

    list: async (): Promise<JobRecord[]> => {
      const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC')
      const rows = stmt.all() as DbJobRow[]
      return rows.map((row) => this.mapDbJobToRecord(row))
    },

    update: async (job: JobRecord): Promise<void> => {
      const stmt = this.db.prepare(`
        UPDATE jobs
        SET kind = ?, status = ?, title = ?, progress_json = ?, updated_at = ?, error_message = ?
        WHERE id = ?
      `)
      stmt.run(
        job.kind,
        job.status,
        job.title,
        job.progress ? JSON.stringify(job.progress) : null,
        job.updatedAt,
        job.errorMessage ?? null,
        job.id
      )
    },

    delete: async (id: string): Promise<void> => {
      const stmt = this.db.prepare('DELETE FROM jobs WHERE id = ?')
      stmt.run(id)
    },
  }

  private mapDbJobToRecord(row: DbJobRow): JobRecord {
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

  assets = {
    create: async (asset: AssetRecord): Promise<void> => {
      const stmt = this.db.prepare(`
        INSERT INTO assets (id, kind, name, path, size, mime_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        asset.id,
        asset.kind,
        asset.name,
        asset.path,
        asset.size ?? null,
        asset.mimeType ?? null,
        asset.createdAt,
        asset.updatedAt
      )
    },

    findById: async (id: string): Promise<AssetRecord | undefined> => {
      const stmt = this.db.prepare('SELECT * FROM assets WHERE id = ?')
      const row = stmt.get(id) as DbAssetRow | undefined
      return row ? this.mapDbAssetToRecord(row) : undefined
    },

    list: async (): Promise<AssetRecord[]> => {
      const stmt = this.db.prepare('SELECT * FROM assets ORDER BY updated_at DESC')
      const rows = stmt.all() as DbAssetRow[]
      return rows.map((row) => this.mapDbAssetToRecord(row))
    },
  }

  private mapDbAssetToRecord(row: DbAssetRow): AssetRecord {
    const record: AssetRecord = {
      id: row.id,
      kind: row.kind as AssetRecord['kind'],
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    if (row.size !== null) record.size = row.size
    if (row.mime_type !== null) record.mimeType = row.mime_type
    return record
  }

  logs = {
    create: async (log: LogEntry): Promise<void> => {
      const stmt = this.db.prepare(`
        INSERT INTO logs (level, module, time, user, event, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      stmt.run(log.level, log.module, log.time, log.user, log.event, log.message)
    },

    list: async (options?: { limit?: number; offset?: number }): Promise<LogEntry[]> => {
      const limit = options?.limit ?? 100
      const offset = options?.offset ?? 0
      const stmt = this.db.prepare('SELECT * FROM logs ORDER BY time DESC LIMIT ? OFFSET ?')
      const rows = stmt.all(limit, offset) as DbLogRow[]
      return rows.map((row) => this.mapDbLogToEntry(row))
    },

    clear: async (): Promise<void> => {
      this.db.prepare('DELETE FROM logs').run()
    },
  }

  settings = {
    get: async (key: string): Promise<string | undefined> => {
      const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined
      return row?.value
    },

    set: async (key: string, value: string): Promise<void> => {
      this.db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `).run(key, value, new Date().toISOString())
    },
  }

  private mapDbLogToEntry(row: DbLogRow): LogEntry {
    return {
      level: row.level,
      module: row.module,
      time: row.time,
      user: row.user,
      event: row.event,
      message: row.message,
    }
  }
}

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

type DbAssetRow = {
  id: string
  kind: string
  name: string
  path: string
  size: number | null
  mime_type: string | null
  created_at: string
  updated_at: string
}

type DbLogRow = {
  id: number
  level: string
  module: string
  time: string
  user: string
  event: string
  message: string
}
