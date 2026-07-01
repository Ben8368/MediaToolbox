import { addLog } from './logs'
import { delay, nowSeconds, randomId } from './shared'

type MockTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'partial'

export type MockTask = {
  id: string
  task_id: string
  title: string
  source_url: string
  status: MockTaskStatus
  progress: number
  stage: string
  created_at: number
  updated_at: number | null
  started_at: number | null
  completed_at: number | null
  params: Record<string, unknown>
  state?: Record<string, unknown>
  result?: Record<string, unknown>
  output_files?: string[]
  error?: string | null
  mock_duration_ms: number
  mock_started_ms: number
}

export const tasks: MockTask[] = []

function titleFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/^www\./, '')} mock download`
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}...` : url || 'Mock download'
  }
}

function outputNameFor(task: MockTask) {
  const safe = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mock-video'
  return `${safe}.mp4`
}

function completeTask(task: MockTask) {
  const fileName = outputNameFor(task)
  const outputDir = typeof task.params.output_dir === 'string' && task.params.output_dir ? task.params.output_dir : '/Workspace/Downloads'
  const localPath = `${outputDir.replace(/\/$/, '')}/${fileName}`
  task.status = 'completed'
  task.progress = 100
  task.stage = 'Demo 下载完成'
  task.completed_at = nowSeconds()
  task.updated_at = task.completed_at
  task.output_files = [localPath]
  task.result = {
    summary_text: '纯前端 Demo 已生成模拟下载结果。',
    items: [
      {
        info: {
          title: task.title,
          webpage_url: task.source_url,
          extractor_key: 'MockFetcher',
          protocol: 'https',
          ext: 'mp4',
          format_id: 'demo-1080p',
          local_path: localPath,
          subtitle_path: task.params.write_subs ? `${outputDir.replace(/\/$/, '')}/${fileName.replace(/\.mp4$/, '.srt')}` : '',
        },
      },
    ],
  }
  addLog('NOTICE', 'downloader', `任务完成：${task.title}`)
}

export function refreshTasks() {
  const now = Date.now()
  for (const task of tasks) {
    if (task.status !== 'pending' && task.status !== 'running') continue
    if (now < task.mock_started_ms) {
      task.status = 'pending'
      task.stage = '等待 Demo 调度'
      task.progress = 0
      continue
    }
    if (!task.started_at) task.started_at = nowSeconds()
    task.status = 'running'
    const elapsed = now - task.mock_started_ms
    const progress = Math.min(100, Math.round((elapsed / task.mock_duration_ms) * 1000) / 10)
    task.progress = progress
    task.stage = progress < 35 ? '解析媒体信息' : progress < 78 ? '模拟下载数据' : '写入 Demo 结果'
    task.updated_at = nowSeconds()
    if (progress >= 100) completeTask(task)
  }
}

/** 任务状态中文标签 */
export function statusLabel(status: string) {
  if (status === 'pending') return '等待中'
  if (status === 'running') return '进行中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  if (status === 'failed') return '失败'
  if (status === 'paused') return '已停止'
  return status
}

export async function submitFetch(draft: Record<string, unknown>) {
  await delay(260)
  refreshTasks()
  const urls = Array.isArray(draft.urls) ? draft.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  const source = urls.length ? urls.join(', ') : String(draft.url || 'https://example.com/demo-video')
  const created = nowSeconds()
  const task: MockTask = {
    id: `mock-${randomId()}`,
    task_id: '',
    title: titleFromUrl(urls[0] || source),
    source_url: source,
    status: 'pending',
    progress: 0,
    stage: '等待 Demo 调度',
    created_at: created,
    updated_at: created,
    started_at: null,
    completed_at: null,
    params: draft,
    state: { mode: 'frontend-lite', note: '此任务由本地状态模拟，没有真实网络下载。' },
    mock_duration_ms: 11_000 + Math.floor(Math.random() * 8_000),
    mock_started_ms: Date.now() + 700,
  }
  task.task_id = task.id
  tasks.unshift(task)
  addLog('NOTICE', 'downloader', `创建模拟下载任务：${task.title}`)
  return { ok: true, task_id: task.id, status: task.status }
}

export async function getActiveTasks() {
  await delay(120)
  refreshTasks()
  return { ok: true, tasks: tasks.map(({ mock_duration_ms, mock_started_ms, ...task }) => task) }
}

export async function getWeeklyHistory() {
  await delay(120)
  refreshTasks()
  const terminalStatuses = ['completed', 'failed', 'cancelled', 'paused', 'partial']
  const historyTasks = tasks
    .filter((task) => terminalStatuses.includes(task.status))
    .map(({ mock_duration_ms, mock_started_ms, ...task }) => task)
  return { ok: true, tasks: historyTasks }
}

export async function cancelTask(taskId: string) {
  await delay(140)
  refreshTasks()
  const task = tasks.find((item) => item.id === taskId || item.task_id === taskId)
  if (task && (task.status === 'pending' || task.status === 'running')) {
    task.status = 'cancelled'
    task.stage = 'Demo 任务已停止'
    task.updated_at = nowSeconds()
    task.completed_at = nowSeconds()
    addLog('WARNING', 'downloader', `取消模拟下载任务：${task.title}`)
  }
  return { ok: true }
}

export async function deleteTaskRecord(taskId: string) {
  await delay(120)
  const index = tasks.findIndex((item) => item.id === taskId || item.task_id === taskId)
  if (index >= 0) {
    addLog('INFO', 'downloader', `删除任务记录：${tasks[index].title}`)
    tasks.splice(index, 1)
  }
  return { ok: true }
}

export async function clearTaskRecords(taskIds?: string[]) {
  await delay(140)
  const ids = new Set(taskIds || [])
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    const task = tasks[index]
    const terminal = ['completed', 'failed', 'cancelled', 'paused', 'partial'].includes(task.status)
    if ((ids.size === 0 && terminal) || ids.has(task.id) || ids.has(task.task_id)) tasks.splice(index, 1)
  }
  addLog('INFO', 'downloader', '清理模拟下载记录')
  return { ok: true }
}

export function getFetchTaskFileUrl(taskId: string, path: string) {
  addLog('INFO', 'downloader', `打开模拟任务文件：${taskId} → ${path}`)
  return `data:text/plain;charset=utf-8,Demo%20mode%20file%3A%20${encodeURIComponent(path)}`
}

export const getTask = async (taskId: string) => tasks.find((task) => task.id === taskId) || null
export const getTaskList = getActiveTasks
