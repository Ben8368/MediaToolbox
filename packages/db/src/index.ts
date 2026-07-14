import type { AssetRecord, JobRecord, LogEntry, PathGrantRecord, TrashEntry, WorkOrder } from '@mediatoolbox/contracts'

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
    clear(): Promise<void>
  }
  settings: {
    get(key: string): Promise<string | undefined>
    set(key: string, value: string): Promise<void>
  }
  pathGrants: {
    create(grant: PathGrantRecord): Promise<void>
    findById(id: string): Promise<PathGrantRecord | undefined>
    findActiveById(id: string): Promise<PathGrantRecord | undefined>
    update(grant: Pick<PathGrantRecord, 'id' | 'status' | 'updatedAt'>): Promise<void>
    /** 把 grant 绑定到一个 job；grant 结束生命周期时可据此吊销。已绑定的 grant 不会被覆盖。 */
    bindJob(id: string, jobId: string, updatedAt: number): Promise<void>
    /** 找到绑定了该 job 的活跃 grant（用于 job 进入终态时吊销）。 */
    findActiveByJobId(jobId: string): Promise<PathGrantRecord[]>
    listActive(): Promise<PathGrantRecord[]>
    deleteExpired(): Promise<number>
  }
  workOrders: {
    create(workOrder: WorkOrder): Promise<void>
    findById(id: string): Promise<WorkOrder | undefined>
    update(workOrder: WorkOrder): Promise<void>
    list(): Promise<WorkOrder[]>
    delete(id: string): Promise<void>
  }
  trash: {
    create(workspaceRoot: string, entry: TrashEntry): Promise<void>
    findById(workspaceRoot: string, id: string): Promise<TrashEntry | undefined>
    list(workspaceRoot: string): Promise<TrashEntry[]>
    delete(workspaceRoot: string, id: string): Promise<void>
    clear(workspaceRoot: string): Promise<void>
  }
  close(): void
}

export { SqliteDatabase } from './database.js'
export { CURRENT_SCHEMA_VERSION } from './schema.js'
