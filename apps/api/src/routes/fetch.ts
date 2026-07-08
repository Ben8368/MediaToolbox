import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { BrowserNetworkDownloadRoute, DownloadStrategyAnalysis, DownloadStrategyResponse, FetchTaskRecord, OkResult, SubmitFetchResponse, TaskListResponse } from '@mediatoolbox/contracts'

import { clearFetchTasksSchema, downloadAnalyzeSchema, fetchTaskSubmitSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog, isTerminalTask, nowSeconds } from '../utils.js'
import { executeDownload, abortDownload, updateJob } from '../download-executor.js'
import { readWorkspaceFileForDownload } from '../workspace-files.js'
import { normalizeWorkspacePath } from '../workspace-path.js'

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
  app.post<{ Body: { url: string; requested_route?: 'auto' | 'ytdlp' | 'browser' }; Reply: DownloadStrategyResponse }>(
    '/api/downloads/analyze',
    { schema: downloadAnalyzeSchema },
    async (request) => ({
      ok: true,
      analysis: analyzeDownloadStrategy(request.body.url, request.body.requested_route ?? 'auto'),
    }),
  )

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
    const task = state.fetchTasks.find((item) => item.id === request.params.id || item.task_id === request.params.id)
    if (!task) {
      reply.status(404)
      return { ok: false, message: '下载任务不存在。' }
    }

    const outputFiles = task.output_files ?? []
    const virtualPath = request.query.path
      ? normalizeWorkspacePath(request.query.path, state.workspaceRoot)
      : outputFiles[0]
    if (!virtualPath) {
      reply.status(404)
      return { ok: false, message: '任务尚未记录可下载文件。' }
    }
    if (!outputFiles.includes(virtualPath)) {
      reply.status(403)
      return { ok: false, message: '请求文件不属于该下载任务。' }
    }

    const file = await readWorkspaceFileForDownload(state, virtualPath)
    return reply
      .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      .header('content-length', String(file.size))
      .type('application/octet-stream')
      .send(file.stream)
  })
}

function analyzeDownloadStrategy(url: string, requestedRoute: 'auto' | 'ytdlp' | 'browser'): DownloadStrategyAnalysis {
  const normalized = normalizeDownloadUrl(url)
  const browserReason = '静态文件、图片或用户明确选择浏览器后备时，使用 Browser Network 承接真实浏览器会话下载。'
  const ytdlpReason = '优先使用 yt-dlp：它维护站点 extractor 列表，并支持 embed/generic extractor；是否真正支持以试解析为准。'
  const looksLikeStaticFile = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp|zip|7z|rar|pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(normalized)
  const route: BrowserNetworkDownloadRoute = requestedRoute === 'browser' || (requestedRoute === 'auto' && looksLikeStaticFile) ? 'browser' : 'ytdlp'

  return {
    url: normalized,
    route,
    primary: route === 'browser' ? 'browser-network' as const : 'yt-dlp' as const,
    fallback: route === 'browser' ? null : 'browser-network' as const,
    reason: route === 'browser' ? browserReason : ytdlpReason,
    ytdlp_scope: {
      supported_sites_source: 'yt-dlp supportedsites.md' as const,
      supports_generic_extractor: true,
      supports_embeds: true,
      reliable_check: 'try-extractor' as const,
      media: ['video', 'audio', 'subtitles', 'playlists', 'livestreams', 'metadata'],
    },
  }
}

function normalizeDownloadUrl(input: string): string {
  const parsed = new URL(input)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const error = new Error('下载分析仅支持 http 和 https URL。')
    ;(error as Error & { statusCode?: number }).statusCode = 400
    throw error
  }
  return parsed.href
}
