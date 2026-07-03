import type { FastifyInstance } from 'fastify'
import type { OkResult, RuntimeMetrics, RuntimeMetricsSlice } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'
import { isTerminalTask } from '../utils.js'

function service(id: string, name: string) {
  return {
    id,
    name,
    online: true,
    status: '骨架',
    runtime_status: 'ready',
    availability_status: 'stub',
    mode: 'skeleton',
    mode_label: '骨架模式',
    detail: '契约已接入，真实执行器待实现。',
  }
}

function buildMetrics(state: ApiState): RuntimeMetrics {
  const activeTasks = state.fetchTasks.filter((task) => !isTerminalTask(task))
  return {
    runtime: { uptime_seconds: Math.floor((Date.now() - state.startedAt) / 1000) },
    system: {
      cpu_percent: 0,
      memory_percent: 0,
      gpu_percent: 0,
      gpu_available: false,
      gpu_detail: '系统指标采集器待接入。',
    },
    network: {
      upload: { text: '0 B/s' },
      download: { text: '0 B/s' },
      upload_bytes_per_sec: 0,
      download_bytes_per_sec: 0,
    },
    services: [service('api', '本地 API'), service('downloader', '下载服务'), service('file-manager', '文件管理')],
    tasks: activeTasks.map((task) => ({
      id: task.id,
      name: task.title,
      source: task.source_url,
      type: 'download',
      status: task.status,
      status_label: task.status === 'pending' ? '等待中' : task.status,
      stage: task.stage,
      progress: task.progress,
      can_cancel: task.status === 'pending' || task.status === 'running',
    })),
    task_summary: {
      active_downloads: activeTasks.length,
      total_download_records: state.fetchTasks.length,
      terminal_download_records: state.fetchTasks.filter(isTerminalTask).length,
    },
    log_mode: 'api-skeleton',
  }
}

export function registerSystemRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Reply: RuntimeMetrics }>('/api/system/metrics', async () => buildMetrics(state))
  app.get<{ Reply: RuntimeMetricsSlice }>('/api/system/runtime', async () => {
    const metrics = buildMetrics(state)
    const slice: RuntimeMetricsSlice = {}
    if (metrics.runtime) slice.runtime = metrics.runtime
    if (metrics.system) slice.system = metrics.system
    if (metrics.network) slice.network = metrics.network
    return slice
  })
  app.post<{ Reply: OkResult }>('/api/system/shutdown', async (_request, reply) => {
    reply.send({ ok: true, message: '正在关闭本地服务...' })
    setTimeout(() => {
      app.close().then(() => process.exit(0)).catch(() => process.exit(1))
    }, 100)
  })
}
