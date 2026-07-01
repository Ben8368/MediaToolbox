import { useCallback, useMemo, useState } from 'react'

import {
  emptyFilebrowserTrash,
  fetchFilebrowserTrash,
  purgeFilebrowserTrash,
  restoreFilebrowserTrash,
} from '@/api'
import type { FileEntry, TrashEntry } from '@/apps/file-manager/types'
import { TRASH_PATH } from '@/apps/file-manager/utils'
import { getErrorMessage } from '@/utils'

type UseFileManagerTrashOpts = {
  currentPath: string
  setError: (message: string) => void
  enterTrashView: () => void
}

export function useFileManagerTrash({ currentPath, setError, enterTrashView }: UseFileManagerTrashOpts) {
  const [activeSection, setActiveSection] = useState<'local' | 'trash'>('local')
  const [trashItems, setTrashItems] = useState<TrashEntry[]>([])

  const isTrashView = currentPath === TRASH_PATH

  const trashEntries = useMemo<FileEntry[]>(() => trashItems.map((item) => ({
    name: item.name,
    path: item.id,
    size: item.size,
    modified: item.deleted_at,
    type: item.type,
    original_path: item.original_path,
  })), [trashItems])

  const loadTrash = useCallback(async () => {
    setError('')
    try {
      const data = await fetchFilebrowserTrash()
      setTrashItems(data?.items || [])
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '回收站加载失败')
    }
  }, [setError])

  const openTrash = useCallback(() => {
    setActiveSection('trash')
    enterTrashView()
    void loadTrash()
  }, [enterTrashView, loadTrash])

  const markLocalSection = useCallback(() => {
    setActiveSection('local')
  }, [])

  const restoreSelected = useCallback(async (ids: string[]) => {
    if (!ids.length || !isTrashView) return
    try {
      await Promise.all(ids.map((id) => restoreFilebrowserTrash(id)))
      await loadTrash()
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '恢复失败')
      throw err
    }
  }, [isTrashView, loadTrash, setError])

  const purgeSelected = useCallback(async (ids: string[]) => {
    if (!ids.length || !isTrashView) return
    if (!window.confirm(`确定彻底删除选中的 ${ids.length} 项吗？此操作不可恢复。`)) return
    try {
      await Promise.all(ids.map((id) => purgeFilebrowserTrash(id)))
      await loadTrash()
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '彻底删除失败')
      throw err
    }
  }, [isTrashView, loadTrash, setError])

  const emptyTrash = useCallback(async () => {
    if (!isTrashView || trashItems.length === 0) return
    if (!window.confirm('确定清空回收站吗？此操作不可恢复。')) return
    try {
      await emptyFilebrowserTrash()
      await loadTrash()
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '清空回收站失败')
      throw err
    }
  }, [isTrashView, loadTrash, setError, trashItems.length])

  return {
    activeSection,
    trashItems,
    trashEntries,
    isTrashView,
    loadTrash,
    openTrash,
    markLocalSection,
    restoreSelected,
    purgeSelected,
    emptyTrash,
  }
}
