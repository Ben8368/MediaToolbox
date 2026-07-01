/**
 * routes/tasks — /api/fetch/tasks 全部端点
 * 与前端 api/real/tasks.ts 契约完全对齐。
 */
import { createReadStream, existsSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { enqueue } from '../queue/taskQueue.js'
import { getCancelHandle } from '../services/downloader/index.js'
import {
  upsertTask,
  getActiveTasks,
  getHistoryTasks,
  getTask,
  deleteTask,
  deleteTasks,
} from '../store/taskStore.js'
import type { SubmitFetchBody, Task } from '../types/task.js'

const WORK_DIR = resolve(process.env.WORK_DIR ?? process.cwd())

export async function tasksRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/fetch/tasks — 提交下载任务 ────────────────────────────────
  app.post<{ Body: SubmitFetchBody }>('/api/fetch/tasks', async (req, reply) => {
    const body = req.body
    if (!body.urls || body.urls.length === 0) {
      return reply.status(400).send({ ok: false, message: '缺少 urls 字段' })
    }

    // 校验所有 URL 必须是 http/https，提前拒绝非法输入
    const ALLOWED_URL_RE = /^https?:\/\//i
    const invalidUrl = body.urls.find((u) => u.trim() && !ALLOWED_URL_RE.test(u.trim()))
    if (invalidUrl) {
      return reply.status(400).send({ ok: false, message: `非法 URL（必须以 http:// 或 https:// 开头）: ${invalidUrl}` })
    }

    // 每个 URL 建立一个独立任务
    const taskIds: string[] = []
    for (const url of body.urls) {
      if (!url.trim()) continue
      const taskId = randomUUID()
      const now = Date.now()
      const task: Task = {
        id: taskId,
        type: 'fetch',
        name: url,
        source_url: url,
        status: 'pending',
        progress: 0,
        stage: 'pending',
        created_at: now,
        updated_at: null,
        started_at: null,
        completed_at: null,
        paused_at: null,
        // 把请求体（含 download_options）存入 params，worker 取用
        params: { ...body, url },
      }
      upsertTask(task)
      enqueue(taskId)
      taskIds.push(taskId)
    }

    // 单 URL 时返回 task_id，多 URL 时返回第一个
    return reply.send({ ok: true, task_id: taskIds[0] ?? null, status: 'pending' })
  })

  // ── GET /api/fetch/tasks — 活动任务 ─────────────────────────────────────
  app.get('/api/fetch/tasks', async (_req, reply) => {
    const tasks = getActiveTasks()
    return reply.send({ ok: true, tasks })
  })

  // ── GET /api/fetch/tasks/history — 最近 7 天历史 ─────────────────────────
  // 注意：此路由必须在 /:id 之前注册，否则 'history' 会被当作 id 匹配
  app.get('/api/fetch/tasks/history', async (_req, reply) => {
    const tasks = getHistoryTasks()
    return reply.send({ ok: true, tasks })
  })

  // ── POST /api/fetch/tasks/:id/cancel — 取消任务 ─────────────────────────
  app.post<{ Params: { id: string } }>('/api/fetch/tasks/:id/cancel', async (req, reply) => {
    const { id } = req.params
    const task = getTask(id)
    if (!task) return reply.status(404).send({ ok: false, message: '任务不存在' })

    const cancel = getCancelHandle(id)
    if (cancel) {
      cancel()
    } else if (task.status === 'pending') {
      // 还在队列中，直接标为取消
      upsertTask({ ...task, status: 'cancelled', stage: 'cancelled', updated_at: Date.now() })
    }

    return reply.send({ ok: true })
  })

  // ── DELETE /api/fetch/tasks/:id — 删除任务记录 ───────────────────────────
  app.delete<{ Params: { id: string } }>('/api/fetch/tasks/:id', async (req, reply) => {
    const { id } = req.params
    const deleted = deleteTask(id)
    if (!deleted) return reply.status(404).send({ ok: false, message: '任务不存在' })
    return reply.send({ ok: true })
  })

  // ── POST /api/fetch/tasks/clear — 批量清理记录 ───────────────────────────
  app.post<{ Body: { task_ids?: string[] } }>('/api/fetch/tasks/clear', async (req, reply) => {
    const ids = req.body?.task_ids ?? []
    if (ids.length > 0) {
      deleteTasks(ids)
    }
    return reply.send({ ok: true })
  })

  // ── GET /api/fetch/tasks/:id/file — 下载产出文件 ────────────────────────
  app.get<{ Params: { id: string }; Querystring: { path?: string } }>(
    '/api/fetch/tasks/:id/file',
    async (req, reply) => {
      const { id } = req.params
      const relativePath = req.query.path
      if (!relativePath) {
        return reply.status(400).send({ ok: false, message: '缺少 path 参数' })
      }
      const task = getTask(id)
      if (!task) return reply.status(404).send({ ok: false, message: '任务不存在' })

      // 安全检查：用 relative() 而非 startsWith，避免 Windows 大小写绕过
      const absPath = resolve(join(WORK_DIR, relativePath))
      const rel = relative(WORK_DIR, absPath)
      if (rel.startsWith('..') || isAbsolute(rel)) {
        return reply.status(403).send({ ok: false, message: '路径越界' })
      }
      if (!existsSync(absPath)) {
        return reply.status(404).send({ ok: false, message: '文件不存在' })
      }

      const filename = basename(absPath)
      void reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      return reply.send(createReadStream(absPath))
    },
  )
}
