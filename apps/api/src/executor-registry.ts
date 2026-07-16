export type ExecutorRunner = (signal: AbortSignal) => Promise<void>

type ActiveExecutor = {
  controller: AbortController
  promise: Promise<void>
}

/**
 * API 进程内所有后台 executor 的统一生命周期登记表。
 *
 * Fastify 关闭时先广播 abort，再等待已登记任务完成清理，最后才允许关闭 SQLite。
 * 这样 executor 的终态写入、PathGrant 回收和临时文件清理不会与数据库关闭竞争。
 */
export class ExecutorRegistry {
  private readonly active = new Map<string, ActiveExecutor>()
  private closing = false

  get size(): number {
    return this.active.size
  }

  get isClosing(): boolean {
    return this.closing
  }

  run(jobId: string, runner: ExecutorRunner): Promise<void> {
    if (this.closing) {
      return Promise.reject(new Error('Executor registry is shutting down.'))
    }
    if (this.active.has(jobId)) {
      return Promise.reject(new Error(`Executor ${jobId} is already running.`))
    }

    const controller = new AbortController()
    let trackedPromise: Promise<void>
    const runnerPromise = Promise.resolve().then(() => runner(controller.signal))
    trackedPromise = runnerPromise.finally(() => {
      const current = this.active.get(jobId)
      if (current?.promise === trackedPromise) this.active.delete(jobId)
    })
    this.active.set(jobId, { controller, promise: trackedPromise })
    return trackedPromise
  }

  abort(jobId: string): boolean {
    const executor = this.active.get(jobId)
    if (!executor) return false
    executor.controller.abort()
    return true
  }

  async shutdown(): Promise<void> {
    this.closing = true
    for (const executor of this.active.values()) executor.controller.abort()

    while (this.active.size > 0) {
      await Promise.allSettled([...this.active.values()].map((executor) => executor.promise))
    }
  }
}
