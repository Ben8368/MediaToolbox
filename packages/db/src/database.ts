import Database from 'better-sqlite3'
import type { AssetRecord, LogEntry, WorkOrder } from '@mediatoolbox/contracts'
import { SCHEMA_V1, SCHEMA_V2_SETTINGS, SCHEMA_V3_PATH_GRANTS, SCHEMA_V4_WORKORDERS, SCHEMA_V5_TRASH, SCHEMA_V6_JOB_ATTEMPTS } from './schema.js'
import type { MediaToolboxDatabase } from './types.js'
import { createJobRepository } from './job-repository.js'
import { createPathGrantRepository } from './path-grant-repository.js'
import { createTrashRepository } from './trash-repository.js'

export class SqliteDatabase implements MediaToolboxDatabase {
  private db: Database.Database
  readonly jobs: MediaToolboxDatabase['jobs']
  readonly pathGrants: MediaToolboxDatabase['pathGrants']
  readonly trash: MediaToolboxDatabase['trash']

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initializeSchema()
    this.jobs = createJobRepository(this.db)
    this.pathGrants = createPathGrantRepository(this.db)
    this.trash = createTrashRepository(this.db)
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
      currentVersion = 2
    }

    if (currentVersion < 3) {
      this.db.exec(SCHEMA_V3_PATH_GRANTS)
      this.recordSchemaVersion(3)
      currentVersion = 3
    }

    if (currentVersion < 4) {
      this.db.exec(SCHEMA_V4_WORKORDERS)
      this.recordSchemaVersion(4)
      currentVersion = 4
    }

    if (currentVersion < 5) {
      this.db.exec(SCHEMA_V5_TRASH)
      this.recordSchemaVersion(5)
      currentVersion = 5
    }

    if (currentVersion < 6) {
      this.db.exec(SCHEMA_V6_JOB_ATTEMPTS)
      this.recordSchemaVersion(6)
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

  readonly workOrders: MediaToolboxDatabase['workOrders'] = {
    create: async (workOrder: WorkOrder): Promise<void> => {
      this.db
        .prepare(
          `INSERT INTO psd_workorders (id, psd_path, psd_file_name, document_width, document_height, document_resolution, records_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          workOrder.id,
          workOrder.psdPath,
          workOrder.psdFileName,
          workOrder.documentWidth,
          workOrder.documentHeight,
          workOrder.documentResolution,
          JSON.stringify(workOrder.records),
          workOrder.createdAt,
          workOrder.updatedAt,
        )
    },

    findById: async (id: string): Promise<WorkOrder | undefined> => {
      const row = this.db
        .prepare('SELECT * FROM psd_workorders WHERE id = ?')
        .get(id) as DbWorkOrderRow | undefined
      return row ? this.mapDbWorkOrderToRecord(row) : undefined
    },

    update: async (workOrder: WorkOrder): Promise<void> => {
      this.db
        .prepare(
          `UPDATE psd_workorders
           SET records_json = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(JSON.stringify(workOrder.records), workOrder.updatedAt, workOrder.id)
    },

    list: async (): Promise<WorkOrder[]> => {
      const rows = this.db
        .prepare('SELECT * FROM psd_workorders ORDER BY updated_at DESC')
        .all() as DbWorkOrderRow[]
      return rows.map((r) => this.mapDbWorkOrderToRecord(r))
    },

    delete: async (id: string): Promise<void> => {
      this.db.prepare('DELETE FROM psd_workorders WHERE id = ?').run(id)
    },
  }

  private mapDbWorkOrderToRecord(row: DbWorkOrderRow): WorkOrder {
    return {
      id: row.id,
      psdPath: row.psd_path,
      psdFileName: row.psd_file_name,
      documentWidth: row.document_width,
      documentHeight: row.document_height,
      documentResolution: row.document_resolution,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      records: JSON.parse(row.records_json),
    }
  }

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

type DbWorkOrderRow = {
  id: string
  psd_path: string
  psd_file_name: string
  document_width: number
  document_height: number
  document_resolution: number
  records_json: string
  created_at: number
  updated_at: number
}
