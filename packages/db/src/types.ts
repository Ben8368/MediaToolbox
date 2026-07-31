import type {
  AssetRecord,
  JobRecord,
  JobStatus,
  LogEntry,
  PathGrantRecord,
  TrashEntry,
  WorkOrder,
} from '@mediatoolbox/contracts'

export type MediaToolboxDatabase = {
  jobs: {
    create(job: JobRecord, execution?: JobExecutionDraft): Promise<void>
    findById(id: string): Promise<JobRecord | undefined>
    /** 仅供 API 内部恢复执行器；不会进入公开 JobRecord/API 响应。 */
    findExecutionByJobId(id: string): Promise<JobExecutionRecord | undefined>
    list(): Promise<JobRecord[]>
    /** 高频状态面板只读取非终态任务，避免历史表增长后每秒全表反序列化。 */
    listActive(): Promise<JobRecord[]>
    update(job: JobRecord): Promise<void>
    /** Compare-and-set write. The record is persisted only when it still has expectedStatus. */
    updateIfStatus(job: JobRecord, expectedStatus: JobStatus): Promise<boolean>
    /** 原子提交 Job 终态与唯一 Asset，避免进程在两次写入之间退出。 */
    completeWithAsset(job: JobRecord, expectedStatus: JobStatus, asset: AssetRecord): Promise<boolean>
    /** Patch volatile execution fields without treating a progress event as a state transition. */
    patchIfStatus(id: string, expectedStatus: JobStatus, patch: Partial<Pick<JobRecord, 'progress' | 'errorMessage'>>, updatedAt: number): Promise<boolean>
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
    /** 原子地把活跃 grant 绑定到一个 job；已绑定、过期或非活跃时返回 false。 */
    bindJob(id: string, jobId: string, updatedAt: number): Promise<boolean>
    /** 原子消费一个活跃 one-shot grant；已消费、过期或非活跃时返回 false。 */
    consume(id: string, jobId: string, updatedAt: number): Promise<boolean>
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

export type JobExecutionDraft = {
  executor: string
  payload: unknown
}

export type JobExecutionRecord = JobExecutionDraft & {
  jobId: string
  createdAt: number
  updatedAt: number
}
