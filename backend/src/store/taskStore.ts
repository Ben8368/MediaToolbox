/**
 * taskStore — JSON 文件持久化 + 内存缓存
 * 零原生依赖，跨平台（Win / macOS / Linux / Docker Alpine）。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Task } from '../types/task.js'

// ─── 存储路径 ────────────────────────────────────────────────────────────────

const STORE_PATH = resolve(process.env.TASK_STORE_PATH ?? './data/tasks.json')

// ─── 内存缓存 ─────────────────────────────────────────────────────────────────

let cache: Map<string, Task> = new Map()
let loaded = false

// ─── 持久化 ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  const dir = dirname(STORE_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function loadFromDisk(): void {
  if (loaded) return
  loaded = true
  ensureDir()
  if (!existsSync(STORE_PATH)) {
    cache = new Map()
    return
  }
  try {
    const raw = readFileSync(STORE_PATH, 'utf-8')
    const items: Task[] = JSON.parse(raw)
    cache = new Map(items.map((t) => [t.id, t]))
  } catch {
    // 文件损坏时从空状态启动，不崩溃
    cache = new Map()
  }
}

function persistToDisk(): void {
  ensureDir()
  const items = Array.from(cache.values())
  writeFileSync(STORE_PATH, JSON.stringify(items, null, 2), 'utf-8')
}

// 防抖句柄：进度更新（running 状态）500ms 内合并写盘，避免高频 writeFileSync 阻塞事件循环
let flushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 立即写盘（状态变更、删除等关键操作）
 */
function persistNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  persistToDisk()
}

/**
 * 防抖写盘（进度更新，500ms 内多次触发只写一次）
 */
function persistDebounced(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    persistToDisk()
  }, 500)
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────

export function getAllTasks(): Task[] {
  loadFromDisk()
  return Array.from(cache.values()).sort((a, b) => b.created_at - a.created_at)
}

export function getActiveTasks(): Task[] {
  return getAllTasks().filter((t) => t.status === 'pending' || t.status === 'running')
}

/** 最近 7 天的历史（完成/失败/取消）*/
export function getHistoryTasks(): Task[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  return getAllTasks().filter(
    (t) =>
      ['completed', 'failed', 'cancelled', 'partial'].includes(t.status) &&
      t.created_at >= cutoff,
  )
}

export function getTask(id: string): Task | undefined {
  loadFromDisk()
  return cache.get(id)
}

export function upsertTask(task: Task, opts?: { debounce?: boolean }): void {
  loadFromDisk()
  cache.set(task.id, task)
  // 进度更新（running）用防抖写盘；状态变更（创建/完成/失败/取消）立即落盘
  const isProgressUpdate = opts?.debounce === true ||
    (task.status === 'running' && opts?.debounce !== false)
  if (isProgressUpdate) {
    persistDebounced()
  } else {
    persistNow()
  }
}

export function deleteTask(id: string): boolean {
  loadFromDisk()
  const existed = cache.delete(id)
  if (existed) persistToDisk()
  return existed
}

export function deleteTasks(ids: string[]): void {
  loadFromDisk()
  let changed = false
  for (const id of ids) {
    if (cache.delete(id)) changed = true
  }
  if (changed) persistToDisk()
}
