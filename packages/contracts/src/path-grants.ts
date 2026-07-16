import type { OkResult } from './core.js'

export type PathGrantKind = 'file.read' | 'file.write' | 'dir.read'
export type PathGrantStatus = 'active' | 'consumed' | 'revoked' | 'expired'

export type PathGrantRecord = {
  id: string
  kind: PathGrantKind
  status: PathGrantStatus
  physicalPath: string
  displayName: string
  expiresAt: number
  createdAt: number
  updatedAt: number
  jobId?: string
}

export type PathGrantInfo = Omit<PathGrantRecord, 'physicalPath'>
export type PathGrantResponse = OkResult & { grant?: PathGrantInfo }
export type PathGrantListResponse = OkResult & { grants: PathGrantInfo[] }
