import type { AssetRecord, JobRecord, LogEntry } from '@mediatoolbox/contracts'

export type MediaToolboxDatabase = {
  jobs: {
    create(job: JobRecord): Promise<void>
    findById(id: string): Promise<JobRecord | undefined>
    list(): Promise<JobRecord[]>
    update(job: JobRecord): Promise<void>
    delete(id: string): Promise<void>
  }
  assets: {
    create(asset: AssetRecord): Promise<void>
    findById(id: string): Promise<AssetRecord | undefined>
    list(): Promise<AssetRecord[]>
  }
  logs: {
    create(log: LogEntry): Promise<void>
    list(options?: { limit?: number; offset?: number }): Promise<LogEntry[]>
  }
  close(): void
}

export { SqliteDatabase } from './database.js'
export { CURRENT_SCHEMA_VERSION } from './schema.js'
