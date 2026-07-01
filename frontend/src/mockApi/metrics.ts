import { tasks, refreshTasks, statusLabel } from './tasks'
import { delay, formatSpeed, service } from './shared'

const startedAt = Date.now()

export async function fetchDoctorStatus() {
  await delay(120)
  return [
    { name: 'downloader', available: true, path: 'Demo 模式：模拟服务已连接' },
    { name: 'mock-ffmpeg', available: true, path: 'Demo 模式：仅展示 UI' },
    { name: 'mock-storage', available: true, path: 'Demo 模式：虚拟工作区' },
  ]
}

export async function getSystemMetrics() {
  await delay(80)
  refreshTasks()
  const t = Date.now() / 1000
  const activeTasks = tasks
    .filter((task) => task.status === 'pending' || task.status === 'running')
    .map((task) => ({
      id: task.id,
      name: task.title,
      source: task.source_url,
      type: 'download',
      status: task.status,
      status_label: statusLabel(task.status),
      stage: task.stage,
      progress: task.progress,
      can_pause: false,
      can_resume: false,
      can_cancel: task.status === 'pending' || task.status === 'running',
    }))
  const up = 18_000 + Math.abs(Math.sin(t / 2)) * 180_000 + Math.random() * 26_000
  const down = 80_000 + Math.abs(Math.cos(t / 2.7)) * 1_500_000 + activeTasks.length * 380_000
  return {
    runtime: { uptime_seconds: Math.floor((Date.now() - startedAt) / 1000) },
    system: {
      cpu_percent: 22 + Math.sin(t / 3) * 8 + Math.random() * 4,
      memory_percent: 48 + Math.cos(t / 4) * 6 + Math.random() * 3,
      gpu_percent: 12 + Math.sin(t / 5) * 5 + Math.random() * 2,
      gpu_available: true,
      gpu_detail: 'Demo 模式：GPU 指标为模拟波动',
    },
    network: {
      upload: { text: formatSpeed(up) },
      download: { text: formatSpeed(down) },
      upload_bytes_per_sec: Math.round(up),
      download_bytes_per_sec: Math.round(down),
    },
    services: [
      service('downloader', '下载服务'),
      service('mock-ffmpeg', 'Mock FFmpeg'),
      service('mock-storage', 'Mock Storage'),
    ],
    tasks: activeTasks,
    task_summary: {
      active_downloads: activeTasks.length,
      total_download_records: tasks.length,
      terminal_download_records: tasks.filter((task) => ['completed', 'failed', 'cancelled', 'partial'].includes(task.status)).length,
    },
    log_mode: 'development',
  }
}

export async function fetchSystemRuntimeMetrics() {
  const metrics = await getSystemMetrics()
  return {
    runtime: metrics.runtime,
    system: metrics.system,
    network: metrics.network,
  }
}

export async function shutdownSystem() {
  await delay(180)
  window.alert('Demo 模式：纯前端版本无需关闭后端服务。')
  return { ok: true }
}

export const restartSystem = shutdownSystem
export const getSystemStatus = getSystemMetrics
export const getModules = async () => ({ ok: true, modules: [] })
export const fetchPlan = async (draft: Record<string, unknown>) => ({ ok: true, draft, message: 'Demo 模式：仅生成模拟计划。' })
export const runAgent = async () => ({ ok: true, answer: 'Demo 模式：AI 能力未接入，仅展示 UI。' })
export const testAgentConnection = async () => ({ ok: true, message: 'Demo 模式：模拟服务已连接。' })
