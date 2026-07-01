import { useCallback, useState } from 'react'

import { cancelTask, clearTaskRecords, deleteTaskRecord, getFetchTaskFileUrl, submitFetch } from '@/api'
import {
  buildRetryPayload,
  createOptimisticTask,
  getTaskDownloadFilePath,
  getTaskSourceUrl,
  mergeTasks,
} from '@/apps/downloader/helpers'
import type { DownloadTask, DownloaderRowMenuAction } from '@/apps/downloader/types'

interface UseDownloaderActionsOpts {
  selectedTasks: DownloadTask[]
  selectedClearableTasks: DownloadTask[]
  refreshLists: () => Promise<void>
  setOptimisticTasks: React.Dispatch<React.SetStateAction<DownloadTask[]>>
  onOptimisticTaskCreated?: (task: DownloadTask) => void
}

export function useDownloaderActions({
  selectedTasks,
  selectedClearableTasks,
  refreshLists,
  setOptimisticTasks,
  onOptimisticTaskCreated,
}: UseDownloaderActionsOpts) {
  const [actionError, setActionError] = useState('')

  const clearRecords = useCallback(async () => {
    if (!selectedClearableTasks.length) return
    setActionError('')
    try {
      const ids = selectedClearableTasks.map((task) => task.id)
      if (ids.length === 1) {
        await deleteTaskRecord(ids[0])
      } else {
        await clearTaskRecords(ids)
      }
      await refreshLists()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '清除记录失败')
    }
  }, [refreshLists, selectedClearableTasks])

  const stopSelected = useCallback(async () => {
    if (!selectedTasks.length) return
    setActionError('')
    try {
      await Promise.all(selectedTasks.map((task) => cancelTask(task.id)))
      await refreshLists()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '停止任务失败')
    }
  }, [refreshLists, selectedTasks])

  const retrySelected = useCallback(async () => {
    if (!selectedTasks.length) return
    setActionError('')
    try {
      for (const task of selectedTasks) {
        const payload = buildRetryPayload(task)
        if (!payload) throw new Error(`任务 ${task.id} 缺少可重试的 URL`)
        const urls = Array.isArray(payload.urls) ? payload.urls.filter((url): url is string => typeof url === 'string') : []
        if (urls.length === 0) throw new Error(`任务 ${task.id} 缺少可重试的 URL`)
        const result = await submitFetch(payload)
        const optimisticTask = createOptimisticTask(urls.join(', '), payload, result)
        setOptimisticTasks((prev) => mergeTasks([optimisticTask], prev))
        onOptimisticTaskCreated?.(optimisticTask)
      }
      await refreshLists()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '重试任务失败')
    }
  }, [onOptimisticTaskCreated, refreshLists, selectedTasks, setOptimisticTasks])

  const handleRowMenuAction = useCallback(
    async (action: DownloaderRowMenuAction, task: DownloadTask) => {
      setActionError('')
      if (action === 'copy_url') {
        const url = getTaskSourceUrl(task)
        if (!url) {
          setActionError('此任务缺少来源链接')
          return
        }
        await navigator.clipboard.writeText(url)
      }
      if (action === 'download_file') {
        const path = getTaskDownloadFilePath(task)
        if (!path) {
          setActionError('此任务尚未记录可下载文件')
          return
        }
        window.open(getFetchTaskFileUrl(task.id, path), '_blank', 'noopener')
      }
      if (action === 'retry') {
        const payload = buildRetryPayload(task)
        if (!payload) {
          setActionError('此任务缺少可重试的 URL')
          return
        }
        try {
          const result = await submitFetch(payload)
          const urls = Array.isArray(payload.urls) ? payload.urls.filter((url): url is string => typeof url === 'string') : []
          const optimisticTask = createOptimisticTask(urls.join(', '), payload, result)
          setOptimisticTasks((prev) => mergeTasks([optimisticTask], prev))
          onOptimisticTaskCreated?.(optimisticTask)
          await refreshLists()
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : '重试任务失败')
        }
      }
      if (action === 'ai_analyze') {
        setActionError('字幕分析功能暂未接入。')
      }
    },
    [onOptimisticTaskCreated, refreshLists, setOptimisticTasks],
  )

  return {
    actionError,
    setActionError,
    clearRecords,
    stopSelected,
    retrySelected,
    handleRowMenuAction,
  }
}
