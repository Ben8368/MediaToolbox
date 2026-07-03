import { apiRequest } from '@/api/http'
import type { OkResult } from '@mediatoolbox/contracts'
import type { JobListResponse, JobRecord, TranscodeJobDraft } from '@/api/types'

export function listJobs(): Promise<JobListResponse> {
  return apiRequest<JobListResponse>('/api/jobs')
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
