import path from 'node:path'
import type { FetchTaskRecord } from '@mediatoolbox/contracts'
import { runDownloadWorkerJob, type DownloadWorkerJob } from '@mediatoolbox/download-worker'
import { YtdlpRunError, YtdlpToolNotFoundError, type YtdlpProgressEvent } from '@mediatoolbox/downloader'
import { parseDataRateText } from './system-sampler.js'

import type { ApiState } from './state.js'
import { addLog, nowSeconds } from './utils.js'
import { toVirtualWorkspacePath } from './workspace-files.js'
import { updateJobRecord } from './job-utils.js'

const activeAbortControllers = new Map<string, AbortController>()
let activeDownloadCount = 0
const downloadQueue: Array<{ task: FetchTaskRecord; state: ApiState }> = []

function drainQueue(): void {
  while (downloadQueue.length > 0) {
    const entry = downloadQueue[0]
    if (!entry || activeDownloadCount >= entry.state.maxConcurrentDownloads) break
    downloadQueue.shift()
    activeDownloadCount++
    void executeDownload(entry.task, entry.state).finally(() => {
      activeDownloadCount--
      drainQueue()
    })
  }
}

export function scheduleDownload(task: FetchTaskRecord, state: ApiState): void {
  if (activeDownloadCount < state.maxConcurrentDownloads) {
    activeDownloadCount++
    void executeDownload(task, state).finally(() => {
      activeDownloadCount--
      drainQueue()
    })
  } else {
    task.stage = `排队中（第 ${downloadQueue.length + 1} 位）`
    downloadQueue.push({ task, state })
  }
}

export function abortDownload(taskId: string): void {
  const queueIndex = downloadQueue.findIndex((entry) => entry.task.id === taskId)
  if (queueIndex >= 0) {
    const [entry] = downloadQueue.splice(queueIndex, 1)
    if (entry) {
      entry.task.status = 'cancelled'
      entry.task.stage = '已取消'
      entry.task.updated_at = nowSeconds()
      entry.task.completed_at = entry.task.updated_at
    }
    return
  }
  activeAbortControllers.get(taskId)?.abort()
  activeAbortControllers.delete(taskId)
}

export async function updateDownloadJob(state: ApiState, taskId: string, nextStatus: Parameters<typeof updateJobRecord>[2]) {
  await updateJobRecord(state, taskId, nextStatus)
}

export async function executeDownload(task: FetchTaskRecord, state: ApiState): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(task.id, controller)

  task.status = 'running'
  task.started_at = nowSeconds()
  task.updated_at = task.started_at
  task.stage = '准备下载'
  await updateDownloadJob(state, task.id, 'running')
  addLog(state.db, 'INFO', 'downloader', `开始下载：${task.title}`)

  try {
    const job = buildDownloadJob(task, state)
    const outputFiles = new Set<string>()

    const result = await runDownloadWorkerJob(job, {
      signal: controller.signal,
      onEvent: (event: YtdlpProgressEvent) => {
        task.updated_at = nowSeconds()
        if (event.type === 'progress') {
          task.progress = event.percent
          const speedBps = parseDataRateText(event.speedText)
          if (speedBps === null) {
            const nextState = { ...(task.state ?? {}) }
            delete nextState.download_bytes_per_sec
            task.state = nextState
          } else if (task.state?.download_bytes_per_sec !== speedBps) {
            task.state = { ...(task.state ?? {}), download_bytes_per_sec: speedBps }
          }
          const speed = event.speedText ? ` @ ${event.speedText}` : ''
          const eta = event.etaText ? ` ETA ${event.etaText}` : ''
          task.stage = `${event.percent}% of ${event.totalText}${speed}${eta}`
        } else if (event.type === 'stage') {
          if (event.stage === 'destination') {
            task.stage = `写入：${event.message}`
            rememberOutputFile(outputFiles, state, event.message)
          } else if (event.stage === 'already-downloaded') {
            task.stage = '已下载过，跳过'
            rememberOutputFile(outputFiles, state, event.message)
          } else if (event.stage === 'merger') {
            task.stage = `合并：${event.message}`
            rememberOutputFile(outputFiles, state, event.message)
          } else if (event.stage === 'finished') task.stage = '后处理完成'
          else task.stage = event.message
        } else if (event.type === 'error') {
          task.stage = `错误：${event.message}`
        }
      },
      onLog: (line: string, stream: 'stdout' | 'stderr') => {
        if (!line.trim()) return
        const level = stream === 'stderr' ? 'WARNING' : 'INFO'
        addLog(state.db, level, 'yt-dlp', `[${task.id}] ${line}`)
      },
    })

    activeAbortControllers.delete(task.id)

    if (result.status === 'canceled') {
      task.status = 'cancelled'
      task.stage = '已取消'
      task.completed_at = nowSeconds()
      task.updated_at = task.completed_at
      await updateDownloadJob(state, task.id, 'canceled')
      addLog(state.db, 'WARNING', 'downloader', `下载已取消：${task.title}`)
    } else {
      task.status = 'completed'
      task.progress = 100
      task.stage = '下载完成'
      task.completed_at = nowSeconds()
      task.updated_at = task.completed_at
      task.output_files = [...outputFiles]
      task.result = {
        status: result.status,
        command: result.command,
        args: result.args,
        exitCode: result.exitCode,
      }
      await updateDownloadJob(state, task.id, 'succeeded')
      addLog(state.db, 'INFO', 'downloader', `下载完成：${task.title}`)
    }
  } catch (error) {
    activeAbortControllers.delete(task.id)
    task.completed_at = nowSeconds()
    task.updated_at = task.completed_at

    if (error instanceof YtdlpToolNotFoundError) {
      task.status = 'failed'
      task.stage = '未找到 yt-dlp'
      task.error = '未找到可用的 yt-dlp，请确认已安装并在 PATH 中。'
      await updateDownloadJob(state, task.id, 'failed')
      addLog(state.db, 'ERROR', 'downloader', `下载失败（yt-dlp 缺失）：${task.title}`)
    } else if (error instanceof YtdlpRunError) {
      task.status = 'failed'
      task.stage = `失败：${error.normalized.message}`
      task.error = error.normalized.message
      await updateDownloadJob(state, task.id, 'failed')
      addLog(state.db, 'ERROR', 'downloader', `下载失败：${task.title} — ${error.normalized.message}`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      task.status = 'failed'
      task.stage = '执行出错'
      task.error = message
      await updateDownloadJob(state, task.id, 'failed')
      addLog(state.db, 'ERROR', 'downloader', `下载出错：${task.title} — ${message}`)
    }
  }
}

export function buildDownloadJob(task: FetchTaskRecord, state?: ApiState): DownloadWorkerJob {
  const params = task.params as Record<string, unknown>
  const urls = Array.isArray(params.urls) ? params.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  const url = typeof params.url === 'string' && params.url.trim().length > 0 ? params.url.trim() : (urls[0]?.trim() ?? '')
  const mode = params.mode === 'audio' ? 'audio' : params.mode === 'subtitles' ? 'subtitles' : 'video'
  return { url, mode, outputTemplate: buildOutputTemplate(state) }
}

function buildOutputTemplate(state?: ApiState): string {
  if (!state) return '%(title)s.%(ext)s'
  const root = state.physicalWorkspaceRoot.replace(/\\/g, '/')
  return `${root}/Downloads/%(title)s.%(ext)s`
}

function rememberOutputFile(outputFiles: Set<string>, state: ApiState, outputPath: string): void {
  const physicalPath = path.resolve(outputPath)
  const root = path.resolve(state.physicalWorkspaceRoot)
  if (physicalPath !== root && !physicalPath.startsWith(`${root}${path.sep}`)) return
  outputFiles.add(toVirtualWorkspacePath(state, physicalPath))
}
