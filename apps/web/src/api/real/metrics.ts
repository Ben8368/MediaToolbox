import { apiRequest } from '@/api/http'
import type { RuntimeMetricsSlice } from '@/api/types'
import type { RuntimeMetrics } from '@/components/RightPanel/types'

export async function getSystemMetrics() {
  return apiRequest<RuntimeMetrics>('/api/system/metrics')
}

export async function fetchSystemRuntimeMetrics() {
  return apiRequest<RuntimeMetricsSlice>('/api/system/runtime')
}

export async function shutdownSystem() {
  return apiRequest<{ ok: boolean }>('/api/system/shutdown', { method: 'POST' })
}
