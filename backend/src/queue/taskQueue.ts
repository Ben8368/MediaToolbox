/**
 * taskQueue — 内存并发队列
 * 限制同时运行的下载 worker 数量；worker 函数由 downloader/index 注册。
 */
import { upsertTask, getTask } from '../store/taskStore.js'
import type { Task } from '../types/task.js'

export type WorkerFn = (task: Task) => Promise<void>

// ─── 配置 ─────────────────────────────────────────────────────────────────────

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_DOWNLOADS ?? 2)

// ─── 内部状态 ─────────────────────────────────────────────────────────────────

let workerFn: WorkerFn | null = null
let running = 0
const pending: string[] = []   // task id 队列

// ─── 公开 API ─────────────────────────────────────────────────────────────────

/** 注册实际执行下载的 worker，由 downloader/index 调用一次 */
export function registerWorker(fn: WorkerFn): void {
  workerFn = fn
}

/** 将任务加入队列；若有空槽立即启动 */
export function enqueue(taskId: string): void {
  pending.push(taskId)
  drain()
}

/** 获取当前运行数（用于日志/状态展示）*/
export function getRunningCount(): number {
  return running
}

// ─── 内部调度 ─────────────────────────────────────────────────────────────────

function drain(): void {
  while (running < MAX_CONCURRENT && pending.length > 0) {
    const id = pending.shift()!
    void runOne(id)
  }
}

async function runOne(id: string): Promise<void> {
  if (!workerFn) return

  const task = getTask(id)
  if (!task) return

  running++
  try {
    await workerFn(task)
  } catch (err: unknown) {
    // worker 内部应自行捕获并写 failed 状态；这里兜底
    const t = getTask(id)
    if (t && t.status === 'running') {
      upsertTask({
        ...t,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        updated_at: Date.now(),
      })
    }
  } finally {
    running--
    drain()
  }
}
