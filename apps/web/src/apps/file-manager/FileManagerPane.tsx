import { useCallback, useEffect, useMemo, useState } from 'react'

import { createFilebrowserDirectory, deleteFilebrowserPath, fetchAssets, filebrowserFileDownloadUrl, uploadFilebrowserFile } from '@/api'
import type { AssetRecord } from '@/api/types'
import { FileManagerEntryTable, FileManagerToolbar } from '@/apps/file-manager/FileManagerMainPanel'
import { FileManagerSidebar } from '@/apps/file-manager/FileManagerSidebar'
import type { DiskInfo } from '@/apps/file-manager/types'
import { isPathOnDisk, joinPath, parentPath, TRASH_PATH } from '@/apps/file-manager/utils'
import { useFilebrowserNavigator } from '@/apps/file-manager/useFilebrowserNavigator'
import { useFileManagerInit } from '@/apps/file-manager/useFileManagerInit'
import { useFileManagerTrash } from '@/apps/file-manager/useFileManagerTrash'
import { getErrorMessage } from '@/utils'

export function FileManagerPane() {
  const {
    currentPath,
    directories,
    files,
    loading,
    error,
    setCurrentPath,
    setDirectories,
    setFiles,
    setError,
    navigate,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useFilebrowserNavigator()
  const [disks, setDisks] = useState<DiskInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [activeDiskPath, setActiveDiskPath] = useState('')
  const [lastLocalPath, setLastLocalPath] = useState('')
  const [assets, setAssets] = useState<AssetRecord[]>([])

  const enterTrashView = useCallback(() => {
    setCurrentPath(TRASH_PATH)
    setDirectories([])
    setFiles([])
    setSelected(new Set())
    setSearchText('')
    setError('')
  }, [setCurrentPath, setDirectories, setError, setFiles])

  const trash = useFileManagerTrash({ currentPath, setError, enterTrashView })

  useFileManagerInit({
    navigate,
    setError,
    setDisks,
    setActiveDiskPath,
    setLastLocalPath,
  })

  const refreshAssets = useCallback(async () => {
    try {
      const result = await fetchAssets()
      setAssets(result.assets ?? [])
    } catch {
      setAssets([])
    }
  }, [])

  useEffect(() => {
    void refreshAssets()
  }, [refreshAssets])

  useEffect(() => {
    if (currentPath && currentPath !== TRASH_PATH) {
      setLastLocalPath(currentPath)
      trash.markLocalSection()
      setActiveDiskPath((current) => disks.find((disk) => isPathOnDisk(currentPath, disk.path))?.path || current)
    }
  }, [currentPath, disks, trash.markLocalSection])

  const allEntries = useMemo(
    () => trash.isTrashView ? trash.trashEntries : [...directories, ...files],
    [directories, files, trash.isTrashView, trash.trashEntries],
  )

  const filteredEntries = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return allEntries
    return allEntries.filter((entry) => entry.name.toLowerCase().includes(keyword))
  }, [allEntries, searchText])

  const currentParent = parentPath(currentPath)

  function toggleSelect(path: string) {
    setSelected((items) => {
      const next = new Set(items)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function openLocalFiles() {
    trash.markLocalSection()
    if (trash.isTrashView) {
      const targetPath = lastLocalPath || disks[0]?.path
      if (targetPath) void navigate(targetPath)
    }
  }

  async function createFolder() {
    if (!currentPath || trash.isTrashView) return
    const name = window.prompt('新建文件夹名称')
    if (!name?.trim()) return
    try {
      await createFilebrowserDirectory(joinPath(currentPath, name.trim()))
      await navigate(currentPath, false)
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '新建文件夹失败')
    }
  }

  async function deleteSelected() {
    const paths = Array.from(selected)
    if (!paths.length || trash.isTrashView) return
    if (!window.confirm(`确定将选中的 ${paths.length} 项移入回收站吗？`)) return
    try {
      await Promise.all(paths.map((path) => deleteFilebrowserPath(path, true)))
      setSelected(new Set())
      await navigate(currentPath, false)
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '移入回收站失败')
    }
  }

  async function restoreSelected() {
    const ids = Array.from(selected)
    if (!ids.length) return
    try {
      await trash.restoreSelected(ids)
      setSelected(new Set())
    } catch {
      // error already set in hook
    }
  }

  async function purgeSelected() {
    const ids = Array.from(selected)
    if (!ids.length) return
    try {
      await trash.purgeSelected(ids)
      setSelected(new Set())
    } catch {
      // error already set in hook
    }
  }

  async function emptyTrash() {
    try {
      await trash.emptyTrash()
      setSelected(new Set())
    } catch {
      // error already set in hook
    }
  }

  async function handleUpload(files: FileList) {
    if (!currentPath || trash.isTrashView) return
    const fileArray = Array.from(files)
    if (!fileArray.length) return

    try {
      setError('')
      await Promise.all(fileArray.map((file) => uploadFilebrowserFile(currentPath, file)))
      await navigate(currentPath, false)
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '上传文件失败')
    }
  }

  function downloadSelected() {
    const paths = Array.from(selected).filter((path) => {
      const entry = allEntries.find((e) => e.path === path)
      return entry?.type === 'file'
    })
    if (!paths.length) return

    paths.forEach((path) => {
      const link = document.createElement('a')
      link.href = filebrowserFileDownloadUrl(path)
      link.download = ''
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  return (
    <div className="fm-app">
      <FileManagerSidebar
        activeSection={trash.activeSection}
        disks={disks}
        assets={assets}
        activeDiskPath={activeDiskPath}
        currentPath={currentPath}
        onOpenLocal={openLocalFiles}
        onOpenTrash={trash.openTrash}
        onSelectDisk={(diskPath) => {
          const disk = disks.find((item) => item.path === diskPath)
          if (disk?.browsable === false) {
            setError('当前工作区未映射到此磁盘，仅展示容量信息。')
            return
          }
          setActiveDiskPath(diskPath)
          void navigate(diskPath)
        }}
      />

      <main className="fm-panel">
        <FileManagerToolbar
          isTrashView={trash.isTrashView}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          currentPath={currentPath}
          currentParent={currentParent}
          searchText={searchText}
          selectedCount={selected.size}
          trashCount={trash.trashItems.length}
          onGoBack={goBack}
          onGoForward={goForward}
          onRefresh={() => currentPath && !trash.isTrashView && void navigate(currentPath, false)}
          onGoParent={() => currentParent && void navigate(currentParent)}
          onSearchChange={setSearchText}
          onCreateFolder={() => void createFolder()}
          onDeleteSelected={() => void deleteSelected()}
          onRestoreSelected={() => void restoreSelected()}
          onPurgeSelected={() => void purgeSelected()}
          onEmptyTrash={() => void emptyTrash()}
          onUpload={(files) => void handleUpload(files)}
          onDownloadSelected={downloadSelected}
        />

        <FileManagerEntryTable
          loading={loading}
          error={error}
          isTrashView={trash.isTrashView}
          entries={filteredEntries}
          disks={disks}
          selected={selected}
          onToggleSelect={toggleSelect}
          onOpenDirectory={(path) => void navigate(path)}
        />

        <footer className="fm-status">
          <span>共 {filteredEntries.length} 项</span>
          {selected.size > 0 && <span>已选 {selected.size} 项</span>}
        </footer>
      </main>
    </div>
  )
}
