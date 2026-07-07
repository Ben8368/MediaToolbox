import { apiRequest } from '@/api/http'
import type { AssetListResponse, OkResult, PsdRenderInput } from '@mediatoolbox/contracts'
import type { JobListResponse, JobRecord, PsdInspectResponse, PsdTemplateManifest, TranscodeJobDraft } from '@/api/types'

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

export function inspectPsdTemplate(psdPath: string, inputGrantId?: string): Promise<PsdInspectResponse> {
  return apiRequest<PsdInspectResponse>('/api/psd/templates/inspect', {
    method: 'POST',
    body: JSON.stringify({ psdPath, ...(inputGrantId ? { inputGrantId } : {}) }),
  })
}

export function renderPsdTemplate(
  template: PsdTemplateManifest,
  input: PsdRenderInput,
  outputGrantId?: string,
): Promise<OkResult & { outputPath?: string }> {
  return apiRequest<OkResult & { outputPath?: string }>('/api/psd/render', {
    method: 'POST',
    body: JSON.stringify({ template, input, ...(outputGrantId ? { outputGrantId } : {}) }),
  })
}

export function savePsdManifest(manifest: PsdTemplateManifest): Promise<OkResult> {
  return apiRequest<OkResult>('/api/psd/manifests/save', {
    method: 'POST',
    body: JSON.stringify({ manifest }),
  })
}

export function loadPsdManifest(psdPath: string): Promise<PsdInspectResponse> {
  return apiRequest<PsdInspectResponse>(`/api/psd/manifests/load?psdPath=${encodeURIComponent(psdPath)}`)
}
