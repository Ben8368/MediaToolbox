import { apiRequest, apiUrl } from '@/api/http'
import type { DownloadStrategyResponse, FetchTaskDraft, SubmitFetchResponse, TaskListResponse } from '@mediatoolbox/contracts'

export async function analyzeDownloadStrategy(draft: { url: string; requested_route?: 'auto' | 'ytdlp' | 'browser' }) {
  return apiRequest<DownloadStrategyResponse>('/api/downloads/analyze', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export async function submitFetch(draft: FetchTaskDraft) {
  return apiRequest<SubmitFetchResponse>('/api/fetch/tasks', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export async function getActiveTasks() {
  return apiRequest<TaskListResponse>('/api/fetch/tasks')
}

export async function getWeeklyHistory() {
  return apiRequest<TaskListResponse>('/api/fetch/tasks/history')
}

export async function cancelTask(taskId: string) {
  return apiRequest<{ ok: boolean }>(`/api/fetch/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
  })
}

export async function deleteTaskRecord(taskId: string) {
  return apiRequest<{ ok: boolean }>(`/api/fetch/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  })
}

export async function clearTaskRecords(taskIds?: string[]) {
  return apiRequest<{ ok: boolean }>('/api/fetch/tasks/clear', {
    method: 'POST',
    body: JSON.stringify({ task_ids: taskIds || [] }),
  })
}

export function getFetchTaskFileUrl(taskId: string, path: string) {
  const params = new URLSearchParams({ path })
  return apiUrl(`/api/fetch/tasks/${encodeURIComponent(taskId)}/file?${params}`)
}
