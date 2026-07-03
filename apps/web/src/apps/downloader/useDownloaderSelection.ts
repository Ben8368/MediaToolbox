import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  computeStats,
  getCategoryForTask,
  getTaskSearchHaystack,
  isTaskCancellable,
  isTaskClearable,
  isTaskRetryable,
} from '@/apps/downloader/helpers'
import type { CategoryKey, DownloadTask } from '@/apps/downloader/types'

interface UseDownloaderSelectionOpts {
  mergedTasks: DownloadTask[]
  historyTasks: DownloadTask[]
  queueTasks: DownloadTask[]
}

export function useDownloaderSelection({
  mergedTasks,
  historyTasks,
  queueTasks,
}: UseDownloaderSelectionOpts) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all')
  const [searchText, setSearchText] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectionAnchorIdRef = useRef<string | null>(null)

  // ── Derived data ──

  const sourceTasks = useMemo(() => {
    if (selectedCategory === 'all') return mergedTasks
    if (['completed', 'paused', 'error'].includes(selectedCategory)) return historyTasks
    return queueTasks
  }, [historyTasks, mergedTasks, queueTasks, selectedCategory])

  const stats = useMemo(() => computeStats(mergedTasks), [mergedTasks])

  const filteredTasks = useMemo(() => {
    let filtered = sourceTasks
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((task) => getCategoryForTask(task) === selectedCategory)
    }
    if (searchText.trim()) {
      const keyword = searchText.trim().toLowerCase()
      filtered = filtered.filter((task) => getTaskSearchHaystack(task).includes(keyword))
    }
    return filtered
  }, [searchText, selectedCategory, sourceTasks])

  // Prune selection when filtered list changes
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set([...prev].filter((id) => filteredTasks.some((t) => t.id === id)))
      return next.size === prev.size ? prev : next
    })
  }, [filteredTasks])

  // Auto-select first task when list changes
  useEffect(() => {
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null)
      return
    }
    if (!selectedTaskId || !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0].id)
    }
  }, [filteredTasks, selectedTaskId])

  const selectedTask = useMemo(
    () => mergedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [mergedTasks, selectedTaskId],
  )

  const hasBulkSelection = selectedIds.size > 0
  const selectedTasks = useMemo(() => {
    if (hasBulkSelection) {
      return filteredTasks.filter((task) => selectedIds.has(task.id))
    }
    return selectedTask ? [selectedTask] : []
  }, [filteredTasks, hasBulkSelection, selectedIds, selectedTask])

  // ── Bulk action availability ──

  const canStopSelected = selectedTasks.length > 0 && selectedTasks.every((task) => isTaskCancellable(task))
  const canRetrySelected = selectedTasks.length > 0 && selectedTasks.every((task) => isTaskRetryable(task))
  const selectedClearableTasks = useMemo(() => selectedTasks.filter((task) => isTaskClearable(task)), [selectedTasks])
  const canClearRecords = selectedClearableTasks.length > 0
  const clearRecordsTitle = useMemo(() => {
    if (selectedClearableTasks.length > 0) {
      const n = selectedClearableTasks.length
      const m = selectedTasks.length
      if (m === n) {
        return n === 1 ? '删除当前所选记录的下载历史' : `删除所选 ${n} 条记录的下载历史`
      }
      return `删除其中可清除的 ${n} 条记录（${m - n} 条仍在进行中，将保留）`
    }
    if (!filteredTasks.length) return '暂无可显示的下载任务'
    return '没有可删除的记录：仅已完成、已停止或失败的任务可从列表移除。请先选中任务或使用全选。'
  }, [filteredTasks.length, selectedClearableTasks, selectedTasks])

  const canSelectAllVisible = filteredTasks.length > 0
  const allVisibleSelected = filteredTasks.length > 0 && filteredTasks.every((task) => selectedIds.has(task.id))

  // ── Selection callbacks ──

  const toggleSelectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
      selectionAnchorIdRef.current = null
    } else {
      setSelectedIds(new Set(filteredTasks.map((task) => task.id)))
      selectionAnchorIdRef.current = filteredTasks.length > 0 ? filteredTasks[0].id : null
    }
  }, [allVisibleSelected, filteredTasks])

  const handleRowClick = useCallback(
    (taskId: string, index: number, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const task = filteredTasks.find(t => t.id === taskId)
      if (!task) return

      const isBulkAction = event.ctrlKey || event.metaKey || event.shiftKey
      if (!isBulkAction) {
        setSelectedTaskId(task.id)
        setSelectedIds(new Set())
        selectionAnchorIdRef.current = task.id
        return
      }

      if (event.shiftKey && selectionAnchorIdRef.current) {
        const anchorIndex = filteredTasks.findIndex((t) => t.id === selectionAnchorIdRef.current)
        const clickedIndex = index
        if (anchorIndex !== -1 && clickedIndex !== -1) {
          const start = Math.min(anchorIndex, clickedIndex)
          const end = Math.max(anchorIndex, clickedIndex)
          const rangeIds = new Set(filteredTasks.slice(start, end + 1).map((t) => t.id))
          setSelectedIds(rangeIds)
          return
        }
      }

      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(task.id)) {
          next.delete(task.id)
          if (next.size === 0) {
            selectionAnchorIdRef.current = null
          }
        } else {
          next.add(task.id)
          selectionAnchorIdRef.current = task.id
        }
        return next
      })
    },
    [filteredTasks],
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    selectionAnchorIdRef.current = null
  }, [])

  return {
    selectedCategory,
    setSelectedCategory,
    searchText,
    setSearchText,
    selectedTaskId,
    setSelectedTaskId,
    selectedIds,
    setSelectedIds,
    selectionAnchorIdRef,
    filteredTasks,
    selectedTask,
    selectedTasks,
    selectedClearableTasks,
    stats,
    canStopSelected,
    canRetrySelected,
    canClearRecords,
    clearRecordsTitle,
    canSelectAllVisible,
    allVisibleSelected,
    toggleSelectAllVisible,
    handleRowClick,
    clearSelection,
  }
}
