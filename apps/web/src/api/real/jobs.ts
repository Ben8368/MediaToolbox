import { apiRequest } from '@/api/http'
import type { AssetListResponse, OkResult } from '@mediatoolbox/contracts'
import type { JobListResponse, JobRecord, PsdInspectResponse, TranscodeJobDraft } from '@/api/types'

export function listJobs(): Promise<JobListResponse> {
  return apiRequest<JobListResponse>('/api/jobs')
}

export function fetchAssets(): Promise<AssetListResponse> {
  return apiRequest<AssetListResponse>('/api/assets')
}

export function submitTranscodeJob(draft: TranscodeJobDraft): Promise<JobRecord> {
  return apiRequest<JobRecord>('/api/transcode/jobs', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export function cancelJob(jobId: string): Promise<OkResult> {
  return apiRequest<OkResult>(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  })
}

export function inspectPsdTemplate(psdPath: string): Promise<PsdInspectResponse> {
  return apiRequest<PsdInspectResponse>('/api/psd/templates/inspect', {
    method: 'POST',
    body: JSON.stringify({ psdPath }),
  })
}
