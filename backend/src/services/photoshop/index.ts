/**
 * photoshop/index — Photoshop 服务编排
 * 串联 operations → executor，并注册到 taskQueue
 */
import { registerWorker } from '../../queue/taskQueue.js'
import { upsertTask, getTask } from '../../store/taskStore.js'
import { replaceText, translateLayers, replaceImage, changeFont } from './operations.js'
import type { Task } from '../../types/task.js'

// 运行中的 cancel 句柄 map
const cancelHandles = new Map<string, () => void>()

export function getCancelHandle(taskId: string): (() => void) | undefined {
  return cancelHandles.get(taskId)
}

// ─── worker 实现 ───────────────────────────────────────────────────────────

async function photoshopWorker(task: Task): Promise<void> {
  const params = task.params as Record<string, unknown>
  const operation = params.operation as string

  // 标记为 running
  upsertTask({
    ...task,
    status: 'running',
    stage: 'processing',
    started_at: Date.now(),
    updated_at: Date.now(),
  })

  try {
    switch (operation) {
      case 'replace_text':
        await replaceText({
          psdPath: params.psdPath as string,
          outputPath: params.outputPath as string,
          replacements: params.replacements as Array<{ layerName: string; oldText?: string; newText: string }>,
        })
        break

      case 'translate_layers':
        await translateLayers({
          psdPath: params.psdPath as string,
          outputPath: params.outputPath as string,
          layerNames: params.layerNames as string[],
          targetLanguage: params.targetLanguage as string,
        })
        break

      case 'replace_image':
        await replaceImage({
          psdPath: params.psdPath as string,
          outputPath: params.outputPath as string,
          replacements: params.replacements as Array<{ layerName: string; imagePath: string }>,
        })
        break

      case 'change_font':
        await changeFont({
          psdPath: params.psdPath as string,
          outputPath: params.outputPath as string,
          layerNames: params.layerNames as string[],
          fontFamily: params.fontFamily as string,
          fontSize: params.fontSize as number | undefined,
        })
        break

      default:
        throw new Error(`不支持的 Photoshop 操作: ${operation}`)
    }

    const current = getTask(task.id)
    if (!current) return

    if (current.status === 'cancelled') return

    upsertTask({
      ...current,
      status: 'completed',
      progress: 100,
      stage: 'done',
      completed_at: Date.now(),
      updated_at: Date.now(),
      output_files: [params.outputPath as string],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const current = getTask(task.id)
    if (!current) return

    if (msg === 'cancelled' || current.status === 'cancelled') {
      upsertTask({
        ...current,
        status: 'cancelled',
        stage: 'cancelled',
        updated_at: Date.now(),
      })
    } else if (msg === 'timeout') {
      upsertTask({
        ...current,
        status: 'failed',
        error: 'Photoshop 处理超时，已自动终止',
        stage: 'error',
        updated_at: Date.now(),
      })
    } else {
      upsertTask({
        ...current,
        status: 'failed',
        error: msg,
        stage: 'error',
        updated_at: Date.now(),
      })
    }
  } finally {
    cancelHandles.delete(task.id)
  }
}

// ─── 注册 worker ───────────────────────────────────────────────────────────

export function initPhotoshop(): void {
  registerWorker(photoshopWorker)
}
