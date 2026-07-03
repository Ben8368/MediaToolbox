import type { RuntimeMetrics } from './types'

export function clampPercent(value: number | undefined) {
  return Math.max(0, Math.min(Number(value || 0), 100))
}

export function formatUptime(totalSeconds = 0) {
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${d}天${h}时${m}分${s}秒`
}

export function serviceTitle(service: NonNullable<RuntimeMetrics['services']>[number]) {
  return [service.id, service.detail || service.dep || service.status].filter(Boolean).join(' · ')
}

export function serviceName(service: NonNullable<RuntimeMetrics['services']>[number]) {
  return service.id || service.name
}

export function normalizeServices(services: NonNullable<RuntimeMetrics['services']>) {
  const visibleIds = new Set(['downloader', 'mock-ffmpeg', 'mock-storage'])
  return services
    .filter((service) => service.id !== 'frontend')
    .filter((service) => visibleIds.has(service.id))
}

export function frontendModeLabel(logMode?: string) {
  if (logMode === 'development') return '开发模式'
  return ''
}

export function taskStatusClass(status: string) {
  if (status === 'running') return 'rp-task-status--running'
  if (status === 'pending') return 'rp-task-status--pending'
  if (status === 'paused') return 'rp-task-status--paused'
  return ''
}

export function summarizeGroupStatuses(tasks: NonNullable<RuntimeMetrics['tasks']>) {
  const counts = new Map<string, number>()
  tasks.forEach((task) => {
    const label = task.status_label || task.status
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([label, count]) => `${count} ${label}`)
    .join(' / ')
}

export function appTypeForTaskGroup(type: string, label: string) {
  const text = `${type} ${label}`.toLowerCase()
  if (text.includes('download') || text.includes('下载')) return 'fetcher'
  return ''
}
