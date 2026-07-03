import type { AssetRecord, JobRecord } from '@mediatoolbox/contracts'

export type MediaToolboxDatabase = {
  jobs: {
    create(job: JobRecord): Promise<void>
    findById(id: string): Promise<JobRecord | undefined>
    list(): Promise<JobRecord[]>
  }
  assets: {
    create(asset: AssetRecord): Promise<void>
    findById(id: string): Promise<AssetRecord | undefined>
    list(): Promise<AssetRecord[]>
  }
}
