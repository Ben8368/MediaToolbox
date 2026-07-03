import type { FetchTaskRecord } from '@mediatoolbox/contracts'
import { runDownloadWorkerJob, type DownloadWorkerJob } from '@mediatoolbox/download-worker'
import { YtdlpRunError, YtdlpToolNotFoundError, type YtdlpProgressEvent } from '@mediatoolbox/downloader'
import { transitionJob, canTransitionJob } from '@mediatoolbox/job-core'

import type { ApiState } from './state.js'
import { addLog, nowSeconds } from './utils.js'

const activeAbortControllers = new Map<string, AbortController>()

export function abortDownload(taskId: string): void {
  activeAbortControllers.get(taskId)?.abort()
  activeAbortControllers.delete(taskId)
}

function updateJob(state: ApiState, taskId: string, nextStatus: Parameters<typeof transitionJob>[1]) {
  const idx = state.jobs.findIndex((j) => j.id === taskId)
  if (idx < 0) return
  const job = state.jobs[idx]!
  if (canTransitionJob(job.status, nextStatus)) state.jobs[idx] = transitionJob(job, nextStatus)
}

export async function executeDownload(task: FetchTaskRecord, state: ApiState): Promise<void> {
  const controller = new AbortController()
  activeAbortControllers.set(task.id, controller)

  task.status = 'running'
  task.started_at = nowSeconds()
  task.updated_at = task.started_at
  task.stage = '准备下载'
  updateJob(state, task.id, 'running')
  addLog(state, 'INFO', 'downloader', `开始下载：${task.title}`)

  try {
    const job = buildDownloadJob(task)

    const result = await runDownloadWorkerJob(job, {
      signal: controller.signal,
      onEvent: (event: YtdlpProgressEvent) => {
        task.updated_at = nowSeconds()
        if (event.type === 'progress') {
          task.progress = event.percent
          const speed = event.speedText ? ` @ ${event.speedText}` : ''
          const eta = event.etaText ? ` ETA ${event.etaText}` : ''
          task.stage = `${event.percent}% of ${event.totalText}${speed}${eta}`
        } else if (event.type === 'stage') {
          if (event.stage === 'destination') task.stage = `写入：${event.message}`
          else if (event.stage === 'already-downloaded') task.stage = '已下载过，跳过'
          else if (event.stage === 'finished') task.stage = '后处理完成'
          else task.stage = event.message
        } else if (event.type === 'error') {
          task.stage = `错误：${event.message}`
        }
      },
      onLog: (line: string, stream: 'stdout' | 'stderr') => {
        if (!line.trim()) return
        const level = stream === 'stderr' ? 'WARNING' : 'INFO'
        addLog(state, level, 'yt-dlp', `[${task.id}] ${line}`)
      },
    })

    activeAbortControllers.delete(task.id)

    if (result.status === 'canceled') {
      task.status = 'cancelled'
      task.stage = '已取消'
      task.completed_at = nowSeconds()
      task.updated_at = task.completed_at
      updateJob(state, task.id, 'canceled')
      addLog(state, 'WARNING', 'downloader', `下载已取消：${task.title}`)
    } else {
      task.status = 'completed'
      task.progress = 100
      task.stage = '下载完成'
      task.completed_at = nowSeconds()
      task.updated_at = task.completed_at
      updateJob(state, task.id, 'succeeded')
      addLog(state, 'INFO', 'downloader', `下载完成：${task.title}`)
    }
  } catch (error) {
    activeAbortControllers.delete(task.id)
    task.completed_at = nowSeconds()
    task.updated_at = task.completed_at

    if (error instanceof YtdlpToolNotFoundError) {
      task.status = 'failed'
      task.stage = '未找到 yt-dlp'
      task.error = '未找到可用的 yt-dlp，请确认已安装并在 PATH 中。'
      updateJob(state, task.id, 'failed')
      addLog(state, 'ERROR', 'downloader', `下载失败（yt-dlp 缺失）：${task.title}`)
    } else if (error instanceof YtdlpRunError) {
      task.status = 'failed'
      task.stage = `失败：${error.normalized.message}`
      task.error = error.normalized.message
      updateJob(state, task.id, 'failed')
      addLog(state, 'ERROR', 'downloader', `下载失败：${task.title} — ${error.normalized.message}`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      task.status = 'failed'
      task.stage = '执行出错'
      task.error = message
      updateJob(state, task.id, 'failed')
      addLog(state, 'ERROR', 'downloader', `下载出错：${task.title} — ${message}`)
    }
  }
}

function buildDownloadJob(task: FetchTaskRecord): DownloadWorkerJob {
  const params = task.params as Record<string, unknown>
  const url = typeof params.url === 'string' ? params.url : ''
  const mode = params.mode === 'audio' ? 'audio' : params.mode === 'subtitles' ? 'subtitles' : 'video'
  return { url, mode, outputTemplate: '%(title)s.%(ext)s' }
}
