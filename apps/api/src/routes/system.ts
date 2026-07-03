import os from 'node:os'
import type { FastifyInstance } from 'fastify'
import type { OkResult, RuntimeMetrics, RuntimeMetricsSlice } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'
import { isTerminalTask } from '../utils.js'

const SUPERVISOR_SHUTDOWN_URL = process.env.MEDIATOOLBOX_SUPERVISOR_SHUTDOWN_URL?.trim()

function service(id: string, name: string, detail: string, availabilityStatus = 'ready') {
  return {
    id,
    name,
    online: true,
    status: '运行中',
    runtime_status: 'ready',
    availability_status: availabilityStatus,
    mode: 'local',
    mode_label: '本地服务',
    detail,
  }
}

function cpuPercent() {
  const cpuCount = Math.max(os.cpus().length, 1)
  const oneMinuteLoad = os.loadavg()[0] ?? 0
  return Math.max(0, Math.min(100, Math.round((oneMinuteLoad / cpuCount) * 100)))
}

function memoryPercent() {
  const total = os.totalmem()
  if (!total) return 0
  return Math.round(((total - os.freemem()) / total) * 100)
}

async function buildMetrics(state: ApiState): Promise<RuntimeMetrics> {
  const activeTasks = state.fetchTasks.filter((task) => !isTerminalTask(task))
  const activeBrowserDownloads = state.browserDownloads.filter((download) => download.status === 'pending' || download.status === 'running')
  const jobs = await state.db.jobs.list()
  const activeJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running' || job.status === 'retrying' || job.status === 'paused')
  const browserReceivedBytes = state.browserDownloads.reduce((sum, download) => sum + download.received_bytes, 0)
  const now = Date.now()
  const elapsedSeconds = Math.max((now - state.networkSample.at) / 1000, 0.001)
  const downloadBytesPerSec = Math.max(0, Math.round((browserReceivedBytes - state.networkSample.browserReceivedBytes) / elapsedSeconds))
  state.networkSample = { at: now, browserReceivedBytes }
  return {
    runtime: { uptime_seconds: Math.floor((Date.now() - state.startedAt) / 1000) },
    system: {
      cpu_percent: cpuPercent(),
      memory_percent: memoryPercent(),
      gpu_percent: 0,
      gpu_available: false,
      gpu_detail: 'GPU 指标采集尚未接入；当前返回 CPU 与内存运行时采样。',
    },
    network: {
      upload: { text: formatBytesPerSecond(0) },
      download: { text: formatBytesPerSecond(downloadBytesPerSec) },
      upload_bytes_per_sec: 0,
      download_bytes_per_sec: downloadBytesPerSec,
    },
    services: [
      service('api', '本地 API', 'Fastify API 正在运行。'),
      service('downloader', '下载服务', '下载任务已接入 yt-dlp worker 执行入口。'),
      service('browser-network', '浏览器网络', '浏览器下载事件、权限审计和工作区写入边界已接入。'),
      service('file-manager', '文件管理', `虚拟工作区映射到受控本地目录：${state.physicalWorkspaceRoot}`),
      service('logs', '日志服务', '日志、通知已接入 SQLite 状态。'),
    ],
    tasks: [
      ...activeTasks.map((task) => ({
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
      ...activeBrowserDownloads.map((download) => ({
        id: download.id,
        name: download.filename,
        source: download.source_url,
        type: 'browser-download',
        status: download.status,
        status_label: download.status === 'running' ? '浏览器下载中' : '等待中',
        stage: download.target_path,
        progress: download.total_bytes > 0 ? Math.round((download.received_bytes / download.total_bytes) * 100) : 0,
        can_cancel: true,
      })),
      ...activeJobs
        .filter((job) => job.kind === 'media.transcode' || job.kind === 'psd.batch')
        .map((job) => ({
          id: job.id,
          name: job.title,
          type: job.kind === 'media.transcode' ? 'transcode' : 'psd',
          status: job.status,
          status_label: jobStatusLabel(job.status),
          stage: job.errorMessage || job.kind,
          progress: job.progress ? Math.round((job.progress.current / Math.max(job.progress.total, 1)) * 100) : 0,
          can_cancel: job.status === 'queued' || job.status === 'running' || job.status === 'retrying',
        })),
    ],
    task_summary: {
      active_downloads: activeTasks.length + activeBrowserDownloads.length,
      total_download_records: state.fetchTasks.length + state.browserDownloads.length,
      terminal_download_records: state.fetchTasks.filter(isTerminalTask).length
        + state.browserDownloads.filter((download) => download.status === 'succeeded' || download.status === 'failed' || download.status === 'canceled').length,
    },
    log_mode: 'sqlite-local',
  }
}

export function registerSystemRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Reply: RuntimeMetrics }>('/api/system/metrics', async () => buildMetrics(state))
  app.get<{ Reply: RuntimeMetricsSlice }>('/api/system/runtime', async () => {
    const metrics = await buildMetrics(state)
    const slice: RuntimeMetricsSlice = {}
    if (metrics.runtime) slice.runtime = metrics.runtime
    if (metrics.system) slice.system = metrics.system
    if (metrics.network) slice.network = metrics.network
    return slice
  })
  app.post<{ Reply: OkResult }>('/api/system/shutdown', async (request, reply) => {
    if (request.headers['x-mediatoolbox-shutdown'] !== 'desktop') {
      reply.status(403)
      return { ok: false, message: '缺少本地关机确认标记。' }
    }
    reply.send({ ok: true, message: '正在关闭本地服务...' })
    setTimeout(() => {
      if (SUPERVISOR_SHUTDOWN_URL) {
        notifySupervisorShutdown(SUPERVISOR_SHUTDOWN_URL).catch((error: unknown) => {
          app.log.error(error, 'Supervisor shutdown request failed; falling back to API-only shutdown.')
          app.close().then(() => process.exit(0)).catch(() => process.exit(1))
        })
        return
      }

      app.close().then(() => process.exit(0)).catch(() => process.exit(1))
    }, 100)
  })
}

function formatBytesPerSecond(value: number): string {
  if (value < 1024) return `${value} B/s`
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB/s`
  return `${Math.round(value / 1024 / 102.4) / 10} MB/s`
}

function jobStatusLabel(status: string): string {
  if (status === 'queued') return '排队中'
  if (status === 'running') return '运行中'
  if (status === 'retrying') return '重试中'
  if (status === 'paused') return '暂停'
  return status
}

async function notifySupervisorShutdown(url: string) {
  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Supervisor shutdown request failed with status ${response.status}.`)
  }
}
