import { useEffect } from 'react'

import { fetchFilebrowserDisks, getWorkspace } from '@/api'
import type { DiskInfo } from '@/apps/file-manager/types'
import { isPathOnDisk, resolveInitialPath } from '@/apps/file-manager/utils'
import { getErrorMessage } from '@/utils'

type UseFileManagerInitOpts = {
  navigate: (path: string) => Promise<unknown>
  setError: (message: string) => void
  setDisks: (disks: DiskInfo[]) => void
  setActiveDiskPath: (path: string) => void
  setLastLocalPath: (path: string) => void
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
        const [diskData, workspace] = await Promise.all([fetchFilebrowserDisks(), getWorkspace()])
        if (!alive) return
        const nextDisks = diskData?.disks || []
        const workspacePath = workspace?.workspace?.project_root || workspace?.project_root || ''
        const initialPath = resolveInitialPath('', workspacePath, nextDisks)
        setDisks(nextDisks)
        if (initialPath) {
          setActiveDiskPath(nextDisks.find((disk) => isPathOnDisk(initialPath, disk.path))?.path || '')
          const data = await navigate(initialPath) as { path?: string } | null
          if (alive && data?.path) setLastLocalPath(data.path)
        }
      } catch (err: unknown) {
        if (alive) setError(getErrorMessage(err) || '文件管理初始化失败')
      }
    }

    void init()
    return () => {
      alive = false
    }
  }, [navigate, setActiveDiskPath, setDisks, setError, setLastLocalPath])
}
