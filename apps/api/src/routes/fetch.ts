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

export function registerFetchRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: Record<string, unknown>; Reply: SubmitFetchResponse }>('/api/fetch/tasks', { schema: fetchTaskSubmitSchema }, async (request) => {
    const createdAt = nowSeconds()
    const id = `fetch-${createdAt}-${state.fetchTasks.length + 1}`
    const task: FetchTaskRecord = {
      id,
      task_id: id,
      title: titleFromDraft(request.body),
      source_url: taskSourceFromDraft(request.body),
      status: 'pending',
      progress: 0,
      stage: '等待执行',
      created_at: createdAt,
      updated_at: createdAt,
      started_at: null,
      completed_at: null,
      params: request.body,
      state: {},
    }
    state.fetchTasks.unshift(task)
    state.jobs.unshift(createJobRecord({ id, kind: 'download.video', title: task.title }))
    addLog(state, 'NOTICE', 'downloader', `创建下载任务：${task.title}`)

    // 异步执行，不阻塞 HTTP 响应
    void executeDownload(task, state)

    return { ok: true, task_id: id, status: task.status }
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
      updateJob(state, task.id, 'canceled')
      addLog(state, 'WARNING', 'downloader', `取消下载任务：${task.title}`)
    }
    return { ok: true }
  })

  app.delete<{ Params: { id: string }; Reply: OkResult }>('/api/fetch/tasks/:id', async (request) => {
    const index = state.fetchTasks.findIndex((item) => item.id === request.params.id || item.task_id === request.params.id)
    if (index >= 0) {
      const [removed] = state.fetchTasks.splice(index, 1)
      if (removed) {
        const jobIdx = state.jobs.findIndex((job) => job.id === removed.id)
        if (jobIdx >= 0) state.jobs.splice(jobIdx, 1)
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
        state.fetchTasks.splice(index, 1)
        removedIds.push(task.id)
      }
    }
    for (let index = state.jobs.length - 1; index >= 0; index -= 1) {
      const job = state.jobs[index]
      if (job && removedIds.includes(job.id)) state.jobs.splice(index, 1)
    }
    return { ok: true }
  })

  app.get<{ Params: { id: string }; Querystring: { path?: string } }>('/api/fetch/tasks/:id/file', async (request, reply) => {
    const path = request.query.path || ''
    return reply.type('text/plain; charset=utf-8').send(`任务 ${request.params.id} 的文件访问尚未接入：${path}`)
  })
}
