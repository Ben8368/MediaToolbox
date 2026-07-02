/**
 * routes/photoshop — /api/ps/* 端点
 * Photoshop 自动化任务提交与管理
 */
import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { enqueue } from '../queue/taskQueue.js'
import { getCancelHandle } from '../services/photoshop/index.js'
import { upsertTask, getTask, deleteTask } from '../store/taskStore.js'
import type { Task } from '../types/task.js'

const WORK_DIR = resolve(process.env.WORK_DIR ?? process.cwd())

// ─── 请求体类型定义 ────────────────────────────────────────────────────────

interface ReplaceTextBody {
  psdPath: string
  outputPath: string
  replacements: Array<{
    layerName: string
    oldText?: string
    newText: string
  }>
}

interface TranslateLayersBody {
  psdPath: string
  outputPath: string
  layerNames: string[]
  targetLanguage: string
}

interface ReplaceImageBody {
  psdPath: string
  outputPath: string
  replacements: Array<{
    layerName: string
    imagePath: string
  }>
}

interface ChangeFontBody {
  psdPath: string
  outputPath: string
  layerNames: string[]
  fontFamily: string
  fontSize?: number
}

export async function photoshopRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /api/ps/replace-text — 替换文案 ───────────────────────────────
  app.post<{ Body: ReplaceTextBody }>('/api/ps/replace-text', async (req, reply) => {
    const body = req.body

    // 校验必填字段
    if (!body.psdPath || !body.outputPath || !body.replacements || body.replacements.length === 0) {
      return reply.status(400).send({ ok: false, message: '缺少必填字段' })
    }

    // 安全校验：PSD 路径必须在 WORK_DIR 内
    const absPsdPath = resolve(body.psdPath)
    const rel = relative(WORK_DIR, absPsdPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return reply.status(403).send({ ok: false, message: 'PSD 路径越界' })
    }

    // 校验 PSD 文件存在
    if (!existsSync(absPsdPath)) {
      return reply.status(404).send({ ok: false, message: 'PSD 文件不存在' })
    }

    // 创建任务
    const taskId = randomUUID()
    const now = Date.now()
    const task: Task = {
      id: taskId,
      type: 'photoshop',
      name: `替换文案: ${body.psdPath}`,
      status: 'pending',
      progress: 0,
      stage: 'pending',
      created_at: now,
      updated_at: null,
      started_at: null,
      completed_at: null,
      paused_at: null,
      params: {
        operation: 'replace_text',
        ...body,
      },
    }

    upsertTask(task)
    enqueue(taskId)

    return reply.send({ ok: true, task_id: taskId, status: 'pending' })
  })

  // ─── POST /api/ps/translate-layers — 翻译图层 ───────────────────────────
  app.post<{ Body: TranslateLayersBody }>('/api/ps/translate-layers', async (req, reply) => {
    const body = req.body

    if (!body.psdPath || !body.outputPath || !body.layerNames || !body.targetLanguage) {
      return reply.status(400).send({ ok: false, message: '缺少必填字段' })
    }

    const absPsdPath = resolve(body.psdPath)
    const rel = relative(WORK_DIR, absPsdPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return reply.status(403).send({ ok: false, message: 'PSD 路径越界' })
    }

    if (!existsSync(absPsdPath)) {
      return reply.status(404).send({ ok: false, message: 'PSD 文件不存在' })
    }

    const taskId = randomUUID()
    const now = Date.now()
    const task: Task = {
      id: taskId,
      type: 'photoshop',
      name: `翻译图层: ${body.psdPath}`,
      status: 'pending',
      progress: 0,
      stage: 'pending',
      created_at: now,
      updated_at: null,
      started_at: null,
      completed_at: null,
      paused_at: null,
      params: {
        operation: 'translate_layers',
        ...body,
      },
    }

    upsertTask(task)
    enqueue(taskId)

    return reply.send({ ok: true, task_id: taskId, status: 'pending' })
  })

  // ─── POST /api/ps/replace-image — 替换图片 ──────────────────────────────
  app.post<{ Body: ReplaceImageBody }>('/api/ps/replace-image', async (req, reply) => {
    const body = req.body

    if (!body.psdPath || !body.outputPath || !body.replacements || body.replacements.length === 0) {
      return reply.status(400).send({ ok: false, message: '缺少必填字段' })
    }

    const absPsdPath = resolve(body.psdPath)
    const rel = relative(WORK_DIR, absPsdPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return reply.status(403).send({ ok: false, message: 'PSD 路径越界' })
    }

    if (!existsSync(absPsdPath)) {
      return reply.status(404).send({ ok: false, message: 'PSD 文件不存在' })
    }

    // 校验所有替换图片存在且在安全路径内
    for (const { imagePath } of body.replacements) {
      const absImagePath = resolve(imagePath)
      const imageRel = relative(WORK_DIR, absImagePath)
      if (imageRel.startsWith('..') || isAbsolute(imageRel)) {
        return reply.status(403).send({ ok: false, message: `图片路径越界: ${imagePath}` })
      }
      if (!existsSync(absImagePath)) {
        return reply.status(404).send({ ok: false, message: `替换图片不存在: ${imagePath}` })
      }
    }

    const taskId = randomUUID()
    const now = Date.now()
    const task: Task = {
      id: taskId,
      type: 'photoshop',
      name: `替换图片: ${body.psdPath}`,
      status: 'pending',
      progress: 0,
      stage: 'pending',
      created_at: now,
      updated_at: null,
      started_at: null,
      completed_at: null,
      paused_at: null,
      params: {
        operation: 'replace_image',
        ...body,
      },
    }

    upsertTask(task)
    enqueue(taskId)

    return reply.send({ ok: true, task_id: taskId, status: 'pending' })
  })

  // ─── POST /api/ps/change-font — 修改字体 ────────────────────────────────
  app.post<{ Body: ChangeFontBody }>('/api/ps/change-font', async (req, reply) => {
    const body = req.body

    if (!body.psdPath || !body.outputPath || !body.layerNames || !body.fontFamily) {
      return reply.status(400).send({ ok: false, message: '缺少必填字段' })
    }

    const absPsdPath = resolve(body.psdPath)
    const rel = relative(WORK_DIR, absPsdPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return reply.status(403).send({ ok: false, message: 'PSD 路径越界' })
    }

    if (!existsSync(absPsdPath)) {
      return reply.status(404).send({ ok: false, message: 'PSD 文件不存在' })
    }

    const taskId = randomUUID()
    const now = Date.now()
    const task: Task = {
      id: taskId,
      type: 'photoshop',
      name: `修改字体: ${body.psdPath}`,
      status: 'pending',
      progress: 0,
      stage: 'pending',
      created_at: now,
      updated_at: null,
      started_at: null,
      completed_at: null,
      paused_at: null,
      params: {
        operation: 'change_font',
        ...body,
      },
    }

    upsertTask(task)
    enqueue(taskId)

    return reply.send({ ok: true, task_id: taskId, status: 'pending' })
  })

  // ─── POST /api/ps/tasks/:id/cancel — 取消任务 ───────────────────────────
  app.post<{ Params: { id: string } }>('/api/ps/tasks/:id/cancel', async (req, reply) => {
    const { id } = req.params
    const task = getTask(id)
    if (!task) return reply.status(404).send({ ok: false, message: '任务不存在' })

    const cancel = getCancelHandle(id)
    if (cancel) {
      cancel()
    } else if (task.status === 'pending') {
      upsertTask({ ...task, status: 'cancelled', stage: 'cancelled', updated_at: Date.now() })
    }

    return reply.send({ ok: true })
  })

  // ─── DELETE /api/ps/tasks/:id — 删除任务记录 ────────────────────────────
  app.delete<{ Params: { id: string } }>('/api/ps/tasks/:id', async (req, reply) => {
    const { id } = req.params
    const deleted = deleteTask(id)
    if (!deleted) return reply.status(404).send({ ok: false, message: '任务不存在' })
    return reply.send({ ok: true })
  })
}
