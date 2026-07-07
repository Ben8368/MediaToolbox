import { useEffect } from 'react'

import { fetchFilebrowserDisks, getWorkspace } from '@/api'
import type { DiskInfo } from '@/apps/file-manager/types'
import { isPathOnDisk, resolveInitialPath } from '@/apps/file-manager/utils'
import { getErrorMessage } from '@/utils'

const DISK_REFRESH_MS = 30_000

type UseFileManagerInitOpts = {
  navigate: (path: string) => Promise<unknown>
  setError: (message: string) => void
  setDisks: (disks: DiskInfo[]) => void
  setActiveDiskPath: (path: string) => void
  setLastLocalPath: (path: string) => void
}

async function loadDisks(
  navigate: (path: string) => Promise<unknown>,
  setDisks: (disks: DiskInfo[]) => void,
  setActiveDiskPath: (path: string) => void,
  setLastLocalPath: (path: string) => void,
  initialPathValue: string,
) {
  const [diskData, workspace] = await Promise.all([fetchFilebrowserDisks(), getWorkspace()])
  const nextDisks = diskData?.disks || []
  const workspacePath = workspace?.workspace?.project_root || workspace?.project_root || ''
  const initialPath = resolveInitialPath(initialPathValue, workspacePath, nextDisks)
  setDisks(nextDisks)
  if (initialPath) {
    setActiveDiskPath(nextDisks.find((disk) => isPathOnDisk(initialPath, disk.path))?.path || '')
    const data = await navigate(initialPath) as { path?: string } | null
    if (data?.path) setLastLocalPath(data.path)
  }
}

export function useFileManagerInit({
  navigate,
  setError,
  setDisks,
  setActiveDiskPath,
  setLastLocalPath,
}: UseFileManagerInitOpts) {
  useEffect(() => {
    let alive = true

    async function init() {
      try {
        await loadDisks(navigate, setDisks, setActiveDiskPath, setLastLocalPath, '')
        if (!alive) return
      } catch (err: unknown) {
        if (alive) setError(getErrorMessage(err) || '文件管理初始化失败')
      }
    }

    void init()
    return () => {
      alive = false
    }
  }, [navigate, setActiveDiskPath, setDisks, setError, setLastLocalPath])

  useEffect(() => {
    let alive = true

    async function refreshDisks() {
      try {
        const diskData = await fetchFilebrowserDisks()
        if (!alive) return
        setDisks(diskData?.disks || [])
      } catch {
        // 保留上次采样结果，避免侧边栏闪烁。
      }
    }

    const timer = window.setInterval(() => {
      void refreshDisks()
    }, DISK_REFRESH_MS)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [setDisks])
}
