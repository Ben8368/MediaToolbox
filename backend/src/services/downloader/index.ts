/**
 * downloader/index — 下载编排
 * 串联 argsBuilder → ytdlp → store 更新，并注册到 taskQueue。
 */
import { resolve } from 'node:path'
import { buildYtdlpArgs } from './argsBuilder.js'
import { runYtdlp } from './ytdlp.js'
import { upsertTask, getTask } from '../../store/taskStore.js'
import { registerWorker } from '../../queue/taskQueue.js'
import type { Task, SubmitFetchBody } from '../../types/task.js'

// 工作目录（所有相对 output_dir 都基于此）
const WORK_DIR = resolve(process.env.WORK_DIR ?? process.cwd())

// 运行中的 cancel 句柄 map，用于 /cancel 端点
const cancelHandles = new Map<string, () => void>()

export function getCancelHandle(taskId: string): (() => void) | undefined {
  return cancelHandles.get(taskId)
}

// ─── worker 实现 ───────────────────────────────────────────────────────────

async function downloadWorker(task: Task): Promise<void> {
  const params = task.params as unknown as SubmitFetchBody & { url: string }
  const { url, ...body } = params

  // 标记为 running
  upsertTask({ ...task, status: 'running', stage: 'downloading', started_at: Date.now(), updated_at: Date.now() })

  const { args } = buildYtdlpArgs(body, WORK_DIR)

  // 超时：默认 6 小时，可通过环境变量调整（单位 ms）
  const timeoutMs = Number(process.env.DOWNLOAD_TIMEOUT_MS ?? 6 * 60 * 60 * 1000)

  const handle = runYtdlp(args, url, timeoutMs, (info) => {
    const current = getTask(task.id)
    if (!current || current.status !== 'running') return
    // 进度更新防抖写盘，避免高频 writeFileSync 阻塞事件循环
    upsertTask({
      ...current,
      progress: info.percent,
      stage: info.stage,
      updated_at: Date.now(),
    }, { debounce: true })
  })

  cancelHandles.set(task.id, handle.cancel)

  try {
    const result = await handle.promise
    const current = getTask(task.id)
    if (!current) return

    if (current.status === 'cancelled') return  // 已被外部取消

    upsertTask({
      ...current,
      status: 'completed',
      progress: 100,
      stage: 'done',
      completed_at: Date.now(),
      updated_at: Date.now(),
      result: { stdout_tail: result.stdout.slice(-500) },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const current = getTask(task.id)
    if (!current) return

    if (msg === 'cancelled' || current.status === 'cancelled') {
      upsertTask({ ...current, status: 'cancelled', stage: 'cancelled', updated_at: Date.now() })
    } else if (msg === 'timeout') {
      upsertTask({ ...current, status: 'failed', error: '下载超时，已自动终止', stage: 'error', updated_at: Date.now() })
    } else {
      upsertTask({ ...current, status: 'failed', error: msg, stage: 'error', updated_at: Date.now() })
    }
  } finally {
    cancelHandles.delete(task.id)
  }
}

// ─── 注册 worker，在 server 启动时调用一次 ─────────────────────────────────

export function initDownloader(): void {
  registerWorker(downloadWorker)
}
