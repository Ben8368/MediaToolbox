import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { FetchTaskRecord, OkResult, SubmitFetchResponse, TaskListResponse } from '@mediatoolbox/contracts'

import { clearFetchTasksSchema, fetchTaskSubmitSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog, isTerminalTask, nowSeconds } from '../utils.js'
import { executeDownload, abortDownload, updateJob } from '../download-executor.js'

function titleFromDraft(draft: Record<string, unknown>) {
  const urls = Array.isArray(draft.urls) ? draft.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  const source = urls[0] ?? (typeof draft.url === 'string' ? draft.url : '')
  if (!source) return '待接入下载任务'
  try {
    const parsed = new URL(source)
    return `${parsed.hostname.replace(/^www\./, '')} 下载任务`
  } catch {
    return source.length > 48 ? `${source.slice(0, 45)}...` : source
  }
}

function taskSourceFromDraft(draft: Record<string, unknown>) {
  const urls = Array.isArray(draft.urls) ? draft.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  return urls.length ? urls.join(', ') : String(draft.url || '')
}

function urlsFromDraft(draft: Record<string, unknown>): string[] {
  const urls = Array.isArray(draft.urls)
    ? draft.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []
  if (urls.length) return urls
  return typeof draft.url === 'string' && draft.url.trim() ? [draft.url.trim()] : []
}

function draftForSingleUrl(draft: Record<string, unknown>, url: string): Record<string, unknown> {
  return { ...draft, url, urls: [url] }
}

function createFetchTask(id: string, draft: Record<string, unknown>, createdAt: number): FetchTaskRecord {
  return {
    id,
    task_id: id,
    title: titleFromDraft(draft),
    source_url: taskSourceFromDraft(draft),
    status: 'pending',
    progress: 0,
    stage: '等待执行',
    created_at: createdAt,
    updated_at: createdAt,
    started_at: null,
    completed_at: null,
    params: draft,
    state: {},
  }
}

export function registerFetchRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: Record<string, unknown>; Reply: SubmitFetchResponse }>('/api/fetch/tasks', { schema: fetchTaskSubmitSchema }, async (request) => {
    const createdAt = nowSeconds()
    const urls = urlsFromDraft(request.body)
    if (urls.length === 0) throw new Error('下载任务至少需要一个 URL。')
    const tasks: FetchTaskRecord[] = []

    for (const [index, url] of urls.entries()) {
      const id = `fetch-${createdAt}-${state.fetchTasks.length + index + 1}`
      tasks.push(createFetchTask(id, draftForSingleUrl(request.body, url), createdAt))
    }

    state.fetchTasks.unshift(...tasks)
    for (const task of tasks) {
      await state.db.jobs.create(createJobRecord({ id: task.id, kind: 'download.video', title: task.title }))
      addLog(state.db, 'NOTICE', 'downloader', `创建下载任务：${task.title}`)
      // 异步执行，不阻塞 HTTP 响应
      void executeDownload(task, state)
    }

    const firstTask = tasks[0]!
    return { ok: true, task_id: firstTask.id, task_ids: tasks.map((task) => task.id), status: firstTask.status }
  })

  app.get<{ Reply: TaskListResponse }>('/api/fetch/tasks', async () => ({
    ok: true,
    tasks: state.fetchTasks.filter((task) => !isTerminalTask(task)),
  }))

  app.get<{ Reply: TaskListResponse }>('/api/fetch/tasks/history', async () => ({
    ok: true,
    tasks: state.fetchTasks.filter(isTerminalTask),
  }))

  app.post<{ Params: { id: string }; Reply: OkResult }>('/api/fetch/tasks/:id/cancel', async (request) => {
    const task = state.fetchTasks.find((item) => item.id === request.params.id || item.task_id === request.params.id)
    if (task && !isTerminalTask(task)) {
      abortDownload(task.id)
      // 状态由 executeDownload 的 AbortError 分支更新；这里做保底同步
      if (!isTerminalTask(task)) {
        task.status = 'cancelled'
        task.stage = '已取消'
        task.updated_at = nowSeconds()
        task.completed_at = task.updated_at
      }
      await updateJob(state, task.id, 'canceled')
      addLog(state.db, 'WARNING', 'downloader', `取消下载任务：${task.title}`)
    }
    return { ok: true }
  })

  app.delete<{ Params: { id: string }; Reply: OkResult }>('/api/fetch/tasks/:id', async (request) => {
    const index = state.fetchTasks.findIndex((item) => item.id === request.params.id || item.task_id === request.params.id)
    if (index >= 0) {
      const [removed] = state.fetchTasks.splice(index, 1)
      if (removed) {
        await state.db.jobs.delete(removed.id)
      }
    }
    return { ok: true }
  })

  app.post<{ Body: { task_ids?: string[] }; Reply: OkResult }>('/api/fetch/tasks/clear', { schema: clearFetchTasksSchema }, async (request) => {
    const ids = new Set(request.body.task_ids ?? [])
    const removedIds: string[] = []
    for (let index = state.fetchTasks.length - 1; index >= 0; index -= 1) {
      const task = state.fetchTasks[index]
      if (!task) continue
      if ((ids.size === 0 && isTerminalTask(task)) || ids.has(task.id) || ids.has(task.task_id)) {
        const [removed] = state.fetchTasks.splice(index, 1)
        if (removed) removedIds.push(removed.id)
      }
    }
    await Promise.all(removedIds.map((id) => state.db.jobs.delete(id)))
    return { ok: true }
  })

  app.get<{ Params: { id: string }; Querystring: { path?: string } }>('/api/fetch/tasks/:id/file', async (request, reply) => {
    const path = request.query.path || ''
    return reply.type('text/plain; charset=utf-8').send(`任务 ${request.params.id} 的文件访问尚未接入：${path}`)
  })
}
