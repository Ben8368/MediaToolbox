import Database from 'better-sqlite3'
import type { AssetRecord, JobRecord, LogEntry, PathGrantRecord, WorkOrder } from '@mediatoolbox/contracts'
import { CURRENT_SCHEMA_VERSION, SCHEMA_V1, SCHEMA_V2_SETTINGS, SCHEMA_V3_PATH_GRANTS, SCHEMA_V4_WORKORDERS } from './schema.js'
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

      if (currentVersion < 3) {
        this.db.exec(SCHEMA_V3_PATH_GRANTS)
        this.recordSchemaVersion(3)
        currentVersion = 3
      }

      if (currentVersion < 4) {
        this.db.exec(SCHEMA_V4_WORKORDERS)
        this.recordSchemaVersion(4)
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

  readonly pathGrants: MediaToolboxDatabase['pathGrants'] = {
    create: async (grant) => {
      this.db
        .prepare(
          `INSERT INTO path_grants (id, kind, status, physical_path, display_name, expires_at, created_at, updated_at, job_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
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
      const row = this.db
        .prepare('SELECT * FROM path_grants WHERE id = ?')
        .get(id) as DbPathGrantRow | undefined
      return row ? this.mapDbGrantToRecord(row) : undefined
    },

    findActiveById: async (id) => {
      const row = this.db
        .prepare('SELECT * FROM path_grants WHERE id = ?')
        .get(id) as DbPathGrantRow | undefined
      if (!row) return undefined
      if (row.status !== 'active') return undefined
      if (row.expires_at <= Date.now()) {
        this.db
          .prepare(`UPDATE path_grants SET status = 'expired', updated_at = ? WHERE id = ?`)
          .run(Date.now(), id)
        return undefined
      }
      return this.mapDbGrantToRecord(row)
    },

    update: async ({ id, status, updatedAt }) => {
      this.db
        .prepare('UPDATE path_grants SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, updatedAt, id)
    },

    bindJob: async (id, jobId, updatedAt) => {
      this.db
        .prepare(`UPDATE path_grants SET job_id = ?, updated_at = ? WHERE id = ? AND job_id IS NULL`)
        .run(jobId, updatedAt, id)
    },

    findActiveByJobId: async (jobId) => {
      const rows = this.db
        .prepare(`SELECT * FROM path_grants WHERE job_id = ? AND status = 'active'`)
        .all(jobId) as DbPathGrantRow[]
      return rows.map((r) => this.mapDbGrantToRecord(r))
    },

    listActive: async () => {
      const rows = this.db
        .prepare(`SELECT * FROM path_grants WHERE status = 'active' ORDER BY created_at DESC`)
        .all() as DbPathGrantRow[]
      return rows.map((r) => this.mapDbGrantToRecord(r))
    },

    deleteExpired: async () => {
      const cutoff = Date.now() - 86_400_000
      const result = this.db
        .prepare(`DELETE FROM path_grants WHERE expires_at < ? AND status != 'active'`)
        .run(cutoff)
      return result.changes
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

  private mapDbGrantToRecord(row: DbPathGrantRow): PathGrantRecord {
    const record: PathGrantRecord = {
      id: row.id,
      kind: row.kind as PathGrantRecord['kind'],
      status: row.status as PathGrantRecord['status'],
      physicalPath: row.physical_path,
      displayName: row.display_name,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    if (row.job_id !== null) record.jobId = row.job_id
    return record
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
