import { apiRequest } from '@/api/http'
import type { AssetListResponse, OkResult, WorkOrderScanResponse, WorkOrderGetResponse, WorkOrderApplyResponse, WorkOrder } from '@mediatoolbox/contracts'
import type { JobListResponse, JobRecord, TranscodeCommandPreviewResponse, TranscodeJobDraft, TranscodeProbeResponse } from '@/api/types'

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

export function scanPsd(psdPath: string, inputGrantId?: string): Promise<WorkOrderScanResponse> {
  return apiRequest<WorkOrderScanResponse>('/api/psd/scan', {
    method: 'POST',
    body: JSON.stringify({ psdPath, ...(inputGrantId ? { inputGrantId } : {}) }),
  })
}

export function getWorkOrder(workOrderId: string): Promise<WorkOrderGetResponse> {
  return apiRequest<WorkOrderGetResponse>(`/api/psd/workorders/${encodeURIComponent(workOrderId)}`)
}

export function updateWorkOrder(workOrder: WorkOrder): Promise<OkResult> {
  return apiRequest<OkResult>(`/api/psd/workorders/${encodeURIComponent(workOrder.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ workOrder }),
  })
}

export function applyWorkOrder(
  workOrderId: string,
  outputPath?: string,
  outputGrantId?: string,
): Promise<WorkOrderApplyResponse> {
  return apiRequest<WorkOrderApplyResponse>(`/api/psd/workorders/${encodeURIComponent(workOrderId)}/apply`, {
    method: 'POST',
    body: JSON.stringify({ ...(outputPath ? { outputPath } : {}), ...(outputGrantId ? { outputGrantId } : {}) }),
  })
}

export function probeTranscodeSource(draft: { inputPath?: string; inputGrantId?: string }): Promise<TranscodeProbeResponse> {
  return apiRequest<TranscodeProbeResponse>('/api/transcode/probe', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export function previewTranscodeCommand(draft: { inputPath?: string; outputPath?: string; preset?: string; videoCrf?: number; videoEncodePreset?: string; audioBitrate?: number; targetBitrateKbps?: number }): Promise<TranscodeCommandPreviewResponse> {
  return apiRequest<TranscodeCommandPreviewResponse>('/api/transcode/preview-command', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}
