import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getActiveTasks, getWeeklyHistory } from '@/api'
import { mergeTasks } from '@/apps/downloader/helpers'
import type { DownloadTask } from '@/apps/downloader/types'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'
import { getErrorMessage } from '@/utils'

type ApiTask = {
  id?: string
  task_id?: string
  title?: string
  source_url?: string
  status?: DownloadTask['status']
  progress?: number
  stage?: string
  created_at?: number
  updated_at?: number | null
  started_at?: number | null
  completed_at?: number | null
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  output_files?: string[]
  error?: string | null
}

function mapApiTaskToDownloadTask(task: ApiTask): DownloadTask {
  const id = task.id || task.task_id || ''
  const title = task.title || task.source_url || 'Untitled'
  const outputFiles = Array.isArray(task.output_files) ? task.output_files : []
  return {
    id,
    name: title,
    title: task.title || '',
    source_url: task.source_url || '',
    type: 'download',
    status: task.status || 'pending',
    progress: normalizeProgress(task.progress),
    stage: task.stage || 'queued',
    created_at: typeof task.created_at === 'number' ? task.created_at : 0,
    updated_at: typeof task.updated_at === 'number' ? task.updated_at : null,
    started_at: typeof task.started_at === 'number' ? task.started_at : null,
    completed_at: typeof task.completed_at === 'number' ? task.completed_at : null,
    params: task.params || {},
    result: task.result && Object.keys(task.result).length > 0 ? task.result : outputFiles.length > 0 ? { files: outputFiles } : undefined,
    output_files: outputFiles,
    error: task.error || undefined,
  }
}

function normalizeTaskList(response: unknown): ApiTask[] {
  if (Array.isArray(response)) return response as ApiTask[]
  if (response && typeof response === 'object' && Array.isArray((response as { tasks?: unknown }).tasks)) {
    return (response as { tasks: ApiTask[] }).tasks
  }
  return []
}

function normalizeProgress(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value <= 1 ? value * 100 : value
}

export function useDownloaderTaskData() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [historyTasks, setHistoryTasks] = useState<DownloadTask[]>([])
  const [optimisticTasks, setOptimisticTasks] = useState<DownloadTask[]>([])
  const [pollError, setPollError] = useState('')
  const loadingRef = useRef(false)
  const historyLoadingRef = useRef(false)

  const fetchTasks = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const activeRes = await getActiveTasks()
      const mappedTasks = normalizeTaskList(activeRes).map(mapApiTaskToDownloadTask)

      mappedTasks.sort((a, b) => b.created_at - a.created_at)
      setTasks(mappedTasks)
      setPollError('')
    } catch (err: unknown) {
      setPollError(getErrorMessage(err) || '任务列表刷新失败')
    } finally {
      loadingRef.current = false
    }
  }, [])

  const fetchHistoryTasks = useCallback(async () => {
    if (historyLoadingRef.current) return
    historyLoadingRef.current = true
    try {
      const historyRes = await getWeeklyHistory()
      const mappedHistory = normalizeTaskList(historyRes).map(mapApiTaskToDownloadTask)

      mappedHistory.sort((a, b) => b.created_at - a.created_at)
      setHistoryTasks(mappedHistory)
      setPollError('')
    } catch (err: unknown) {
      setPollError(getErrorMessage(err) || '历史任务刷新失败')
    } finally {
      historyLoadingRef.current = false
    }
  }, [])

  useVisibilityPolling(fetchTasks, 2000)

  useEffect(() => {
    void fetchHistoryTasks()
  }, [fetchHistoryTasks])

  useEffect(() => {
    setOptimisticTasks((prev) =>
      prev.filter(
        (task) => !tasks.some((activeTask) => activeTask.id === task.id) && !historyTasks.some((historyTask) => historyTask.id === task.id),
      ),
    )
  }, [historyTasks, tasks])

  const queueTasks = useMemo(() => mergeTasks(optimisticTasks, tasks), [optimisticTasks, tasks])
  /** history 需在合并时覆盖 queue：避免乐观任务或旧 active 占位（无 result）盖住历史里的完整落盘字段 */
  const mergedTasks = useMemo(() => mergeTasks(historyTasks, queueTasks), [historyTasks, queueTasks])

  const refreshLists = useCallback(async () => {
    await Promise.all([fetchTasks(), fetchHistoryTasks()])
  }, [fetchHistoryTasks, fetchTasks])

  return {
    tasks,
    historyTasks,
    queueTasks,
    mergedTasks,
    pollError,
    fetchHistoryTasks,
    refreshLists,
    setOptimisticTasks,
  }
}
