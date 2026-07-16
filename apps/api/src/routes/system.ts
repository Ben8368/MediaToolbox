import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FastifyInstance } from 'fastify'
import type { OkResult, RuntimeMetrics, RuntimeMetricsSlice } from '@mediatoolbox/contracts'
import { formatBytesPerSecond } from '@mediatoolbox/shared'

import {
  sampleCpuPercent,
  sampleGpu,
  sampleProjectNetworkRates,
} from '../system-sampler.js'
import type { ApiState } from '../state.js'
import { isTerminalTask } from '../utils.js'
import { requireDesktopAuth } from '../desktop-auth.js'

const SUPERVISOR_SHUTDOWN_URL = process.env.MEDIATOOLBOX_SUPERVISOR_SHUTDOWN_URL?.trim()
const execFileAsync = promisify(execFile)
const NETWORK_RATE_CACHE_MS = 900

function service(id: string, name: string, detail: string, availabilityStatus = 'ready', online = true) {
  return {
    id,
    name,
    online,
    status: online ? '运行中' : '未接入',
    runtime_status: online ? 'ready' : 'unavailable',
    availability_status: availabilityStatus,
    mode: 'local',
    mode_label: '本地服务',
    detail,
  }
}

async function memorySnapshot() {
  const total = os.totalmem()
  const free = os.freemem()
  const used = Math.max(0, total - free)
  const physicalPercent = total > 0 ? Math.round((used / total) * 100) : 0
  const pressurePercent = process.platform === 'darwin'
    ? await macosMemoryPressurePercent()
    : undefined

  return {
    total,
    free,
    used,
    percent: pressurePercent ?? physicalPercent,
    pressurePercent,
    pressureLabel: pressurePercent === undefined ? undefined : memoryPressureLabel(pressurePercent),
  }
}

async function buildMetrics(state: ApiState): Promise<RuntimeMetrics> {
  const activeTasks = state.fetchTasks.filter((task) => !isTerminalTask(task))
  const activeBrowserDownloads = state.browserDownloads.filter((download) => download.status === 'pending' || download.status === 'running')
  const activeJobs = await state.db.jobs.listActive()
  const runtimeMetrics = buildRuntimeMetrics(state)
  const [memory, gpu] = await Promise.all([memorySnapshot(), sampleGpu()])
  return {
    ...runtimeMetrics,
    system: {
      cpu_percent: sampleCpuPercent(),
      memory_percent: memory.percent,
      ...(memory.pressurePercent === undefined ? {} : { memory_pressure_percent: memory.pressurePercent }),
      ...(memory.pressureLabel === undefined ? {} : { memory_pressure_label: memory.pressureLabel }),
      memory_used_bytes: memory.used,
      memory_total_bytes: memory.total,
      memory_free_bytes: memory.free,
      gpu_percent: gpu.percent,
      gpu_available: gpu.available,
      gpu_detail: gpu.detail,
    },
    services: [
      service('api', '本地 API', 'Fastify API 正在运行。'),
      service('downloader', '下载服务', '下载任务已接入 yt-dlp worker 执行入口。'),
      service('browser-network', '浏览器网络', '浏览器下载事件、权限审计和工作区写入边界已接入。'),
      service('file-manager', '文件管理', `虚拟工作区已映射到受控本地目录：${state.workspaceRoot}`),
      service('logs', '日志服务', '日志、通知已接入 SQLite 状态。'),
      service(
        'gpu',
        'GPU 指标',
        gpu.available ? `GPU 利用率采样已接入：${gpu.detail}` : gpu.detail,
        gpu.available ? 'ready' : 'degraded',
        gpu.available,
      ),
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
        .filter((job) => job.kind === 'media.transcode' || job.kind === 'psd.scan' || job.kind === 'psd.apply' || job.kind.startsWith('web.render.'))
        .map((job) => ({
          id: job.id,
          name: job.title,
          type: job.kind === 'media.transcode' ? 'transcode' : job.kind === 'psd.scan' || job.kind === 'psd.apply' ? 'psd' : 'web-composer',
          status: job.status,
          status_label: jobStatusLabel(job.status),
          stage: job.errorMessage || job.kind,
          progress: job.progress ? Math.round((job.progress.current / Math.max(job.progress.total, 1)) * 100) : 0,
          can_cancel: job.status === 'queued' || job.status === 'running',
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

function buildRuntimeMetrics(state: ApiState): RuntimeMetricsSlice {
  const networkRates = sampleCachedNetworkRates(state)
  return {
    runtime: { uptime_seconds: Math.floor((Date.now() - state.startedAt) / 1000) },
    network: {
      upload: { text: formatBytesPerSecond(networkRates.uploadBytesPerSec) },
      download: { text: formatBytesPerSecond(networkRates.downloadBytesPerSec) },
      upload_bytes_per_sec: networkRates.uploadBytesPerSec,
      download_bytes_per_sec: networkRates.downloadBytesPerSec,
    },
  }
}

function sampleCachedNetworkRates(state: ApiState) {
  const now = Date.now()
  if (state.networkRatesCache && now - state.networkRatesCache.at < NETWORK_RATE_CACHE_MS) {
    return state.networkRatesCache
  }

  const sampled = sampleProjectNetworkRates(state)
  state.networkSample = sampled.nextSample
  state.networkRatesCache = {
    at: now,
    uploadBytesPerSec: sampled.uploadBytesPerSec,
    downloadBytesPerSec: sampled.downloadBytesPerSec,
  }
  return state.networkRatesCache
}

async function macosMemoryPressurePercent(): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('memory_pressure', ['-Q'], { timeout: 800 })
    const freePercent = Number(stdout.match(/System-wide memory free percentage:\s*(\d+)%/)?.[1])
    if (!Number.isFinite(freePercent)) return undefined
    return Math.max(0, Math.min(100, 100 - freePercent))
  } catch {
    return undefined
  }
}

function memoryPressureLabel(percent: number): string {
  if (percent >= 80) return '压力很高'
  if (percent >= 60) return '压力偏高'
  return '压力正常'
}

export function registerSystemRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Reply: RuntimeMetrics }>('/api/system/metrics', async () => buildMetrics(state))
  app.get<{ Reply: RuntimeMetricsSlice }>('/api/system/runtime', async () => buildRuntimeMetrics(state))
  app.post<{ Reply: OkResult }>('/api/system/shutdown', async (request, reply) => {
    if (!requireDesktopAuth(request, reply, 'x-mediatoolbox-shutdown')) {
      return { ok: false, message: '缺少本地关机授权。' }
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

function jobStatusLabel(status: string): string {
  if (status === 'queued') return '排队中'
  if (status === 'running') return '运行中'
  if (status === 'paused') return '暂停'
  return status
}

async function notifySupervisorShutdown(url: string) {
  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Supervisor shutdown request failed with status ${response.status}.`)
  }
}
