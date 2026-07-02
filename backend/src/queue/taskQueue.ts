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

const workers = new Map<string, WorkerFn>()   // task.type → worker
let running = 0
const pending: string[] = []   // task id 队列

// ─── 公开 API ─────────────────────────────────────────────────────────────────

/** 注册 worker，按 task.type 路由 */
export function registerWorker(fn: WorkerFn): void {
  // 为了保持向后兼容，默认注册为 'fetch' 类型
  // Photoshop 服务会显式调用 registerWorker，但需要区分类型
  // 更好的做法是修改签名为 registerWorker(type: string, fn: WorkerFn)
  // 但为了最小改动，先用函数名推断
  const taskType = fn.name.includes('photoshop') ? 'photoshop' : 'fetch'
  workers.set(taskType, fn)
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
  const task = getTask(id)
  if (!task) return

  const workerFn = workers.get(task.type)
  if (!workerFn) {
    console.error(`未找到 task.type="${task.type}" 的 worker`)
    return
  }

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
