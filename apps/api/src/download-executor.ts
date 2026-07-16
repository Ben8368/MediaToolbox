import fs from 'node:fs/promises'
import path from 'node:path'
import type { FetchTaskDraft, FetchTaskRecord } from '@mediatoolbox/contracts'
import { runDownloadWorkerJob, type DownloadWorkerJob } from '@mediatoolbox/download-worker'
import { YtdlpRunError, YtdlpToolNotFoundError, type YtdlpProgressEvent } from '@mediatoolbox/downloader'
import { parseDataRateText } from './system-sampler.js'

import type { ApiState } from './state.js'
import { addLog, nowSeconds } from './utils.js'
import { toVirtualWorkspacePath } from './workspace-files.js'
import { updateJobRecord } from './job-utils.js'

function drainQueue(state: ApiState): void {
  const scheduler = state.downloadScheduler
  while (scheduler.queue.length > 0) {
    const index = scheduler.queue.findIndex((task) => scheduler.activeCount < state.maxConcurrentDownloads && canStartBatch(task, state))
    if (index < 0) return
    const [task] = scheduler.queue.splice(index, 1)
    if (task) startScheduledDownload(task, state)
  }
}

export function scheduleDownload(task: FetchTaskRecord, state: ApiState): void {
  const scheduler = state.downloadScheduler
  if (scheduler.activeCount < state.maxConcurrentDownloads && canStartBatch(task, state)) {
    startScheduledDownload(task, state)
  } else {
    task.stage = `排队中（第 ${scheduler.queue.length + 1} 位）`
    scheduler.queue.push(task)
  }
}

function startScheduledDownload(task: FetchTaskRecord, state: ApiState): void {
  const scheduler = state.downloadScheduler
  const batchId = batchIdForTask(task)
  scheduler.activeCount++
  scheduler.activeCountsByBatch.set(batchId, (scheduler.activeCountsByBatch.get(batchId) ?? 0) + 1)
  void state.executors.run(task.id, async (signal) => {
    try {
      await executeDownload(task, state, signal)
    } catch (error) {
      addLog(state.db, 'ERROR', 'downloader', `下载执行器清理失败：${error instanceof Error ? error.message : String(error)}`)
    }
  })
    .catch((error) => {
      addLog(state.db, 'ERROR', 'downloader', `下载执行器登记失败：${error instanceof Error ? error.message : String(error)}`)
    })
    .finally(() => {
      scheduler.activeCount--
      const remaining = (scheduler.activeCountsByBatch.get(batchId) ?? 1) - 1
      if (remaining > 0) scheduler.activeCountsByBatch.set(batchId, remaining)
      else scheduler.activeCountsByBatch.delete(batchId)
      if (!state.executors.isClosing) drainQueue(state)
    })
}

function batchIdForTask(task: FetchTaskRecord): string {
  const params = task.params as Record<string, unknown>
  return typeof params.batch_id === 'string' ? params.batch_id : task.id
}

function batchLimitForTask(task: FetchTaskRecord): number {
  const params = task.params as Record<string, unknown>
  const requested = typeof params.max_concurrent === 'number' ? params.max_concurrent : 1
  return Math.max(1, Math.min(4, Math.floor(requested)))
}

function canStartBatch(task: FetchTaskRecord, state: ApiState): boolean {
  return (state.downloadScheduler.activeCountsByBatch.get(batchIdForTask(task)) ?? 0) < batchLimitForTask(task)
}

export function abortDownload(taskId: string, state: ApiState): void {
  const queueIndex = state.downloadScheduler.queue.findIndex((task) => task.id === taskId)
  if (queueIndex >= 0) {
    const [task] = state.downloadScheduler.queue.splice(queueIndex, 1)
    if (task) {
      task.status = 'cancelled'
      task.stage = '已取消'
      task.updated_at = nowSeconds()
      task.completed_at = task.updated_at
    }
    return
  }
  state.executors.abort(taskId)
}

export async function shutdownDownloadScheduler(state: ApiState): Promise<void> {
  const queued = state.downloadScheduler.queue.splice(0)
  await Promise.all(queued.map(async (task) => {
    const canceled = await updateDownloadJob(state, task.id, 'canceled')
    if (!canceled) return
    task.status = 'cancelled'
    task.stage = '服务关闭，任务已取消'
    task.updated_at = nowSeconds()
    task.completed_at = task.updated_at
  }))
}

export async function updateDownloadJob(state: ApiState, taskId: string, nextStatus: Parameters<typeof updateJobRecord>[2]) {
  return updateJobRecord(state, taskId, nextStatus)
}

export async function executeDownload(task: FetchTaskRecord, state: ApiState, signal: AbortSignal): Promise<void> {
  const started = await updateDownloadJob(state, task.id, 'running')
  if (!started) return
  task.status = 'running'
  task.started_at = nowSeconds()
  task.updated_at = task.started_at
  task.stage = '准备下载'
  addLog(state.db, 'INFO', 'downloader', `开始下载：${task.title}`)

  try {
    const job = buildDownloadJob(task, state)
    await fs.mkdir(path.dirname(job.outputTemplate), { recursive: true })
    const outputFiles = new Set<string>()

    const result = await runDownloadWorkerJob(job, {
      signal,
      onEvent: (event: YtdlpProgressEvent) => {
        if (signal.aborted) return
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

    if (result.status === 'canceled') {
      if (await updateDownloadJob(state, task.id, 'canceled')) {
        task.status = 'cancelled'
        task.stage = '已取消'
        task.completed_at = nowSeconds()
        task.updated_at = task.completed_at
        addLog(state.db, 'WARNING', 'downloader', `下载已取消：${task.title}`)
      }
    } else {
      const completed = await updateDownloadJob(state, task.id, 'succeeded')
      if (!completed) {
        await cleanupDownloadOutputFiles(outputFiles, state)
        return
      }
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
      addLog(state.db, 'INFO', 'downloader', `下载完成：${task.title}`)
    }
  } catch (error) {
    task.completed_at = nowSeconds()
    task.updated_at = task.completed_at

    if (error instanceof YtdlpToolNotFoundError) {
      const failed = await updateDownloadJob(state, task.id, 'failed')
      if (!failed) return
      task.status = 'failed'
      task.stage = '未找到 yt-dlp'
      task.error = '未找到可用的 yt-dlp，请确认已安装并在 PATH 中。'
      addLog(state.db, 'ERROR', 'downloader', `下载失败（yt-dlp 缺失）：${task.title}`)
    } else if (error instanceof YtdlpRunError) {
      const failed = await updateDownloadJob(state, task.id, 'failed')
      if (!failed) return
      task.status = 'failed'
      task.stage = `失败：${error.normalized.message}`
      task.error = error.normalized.message
      addLog(state.db, 'ERROR', 'downloader', `下载失败：${task.title} — ${error.normalized.message}`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      const failed = await updateDownloadJob(state, task.id, 'failed')
      if (!failed) return
      task.status = 'failed'
      task.stage = '执行出错'
      task.error = message
      addLog(state.db, 'ERROR', 'downloader', `下载出错：${task.title} — ${message}`)
    }
  }
}

export function buildDownloadJob(task: FetchTaskRecord, state?: ApiState): DownloadWorkerJob {
  const params = task.params as FetchTaskDraft
  const urls = Array.isArray(params.urls) ? params.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  const url = typeof params.url === 'string' && params.url.trim().length > 0 ? params.url.trim() : (urls[0]?.trim() ?? '')
  const mode = params.mode === 'audio' ? 'audio' : params.mode === 'subtitles' ? 'subtitles' : 'video'
  return {
    url,
    mode,
    outputTemplate: buildOutputTemplate(state, params.output_dir),
    // 字幕策略不由客户端选择：yt-dlp 检测到可用字幕时，仅保留原始语言的一份 SRT。
    subtitles: { languages: ['original'], auto: true, format: 'srt' },
    ...(params.cookies_from_browser ? { cookiesFromBrowser: params.cookies_from_browser } : {}),
    // 默认保留最高规格并在合并时优先 MKV；兼容格式仅在完整下载后转为 H.264/MP4，不能先筛掉 VP9/AV1 等最高规格流。
    ...(mode === 'video' ? { video: { mergeOutputFormat: 'mkv', recodeH264: params.compatible_format === true } } : {}),
  }
}

function buildOutputTemplate(state?: ApiState, outputDir?: string): string {
  if (!state) return '%(title)s.%(ext)s'
  const virtualOutputDir = outputDir || `${state.workspaceRoot}/Downloads`
  const physicalOutputDir = path.resolve(state.physicalWorkspaceBase, virtualOutputDir.replace(/^\/Workspace\/?/, ''))
  return path.join(physicalOutputDir, '%(title)s.%(ext)s')
}

async function cleanupDownloadOutputFiles(outputFiles: Set<string>, state: ApiState): Promise<void> {
  await Promise.all([...outputFiles].map(async (virtualPath) => {
    const physicalPath = path.resolve(state.physicalWorkspaceBase, virtualPath.replace(/^\/Workspace\/?/, ''))
    await fs.unlink(physicalPath).catch(() => undefined)
  }))
}

function rememberOutputFile(outputFiles: Set<string>, state: ApiState, outputPath: string): void {
  const physicalPath = path.resolve(outputPath)
  const root = path.resolve(state.physicalWorkspaceRoot)
  if (physicalPath !== root && !physicalPath.startsWith(`${root}${path.sep}`)) return
  outputFiles.add(toVirtualWorkspacePath(state, physicalPath))
}
