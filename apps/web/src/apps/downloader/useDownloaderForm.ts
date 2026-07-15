import { useCallback, useState } from 'react'

import type { CookieBrowser } from '@/apps/downloader/types'

export function useDownloaderForm() {
  const [taskUrl, setTaskUrl] = useState('')
  const [taskOutputDir, setTaskOutputDir] = useState('')
  const [taskCookieBrowser, setTaskCookieBrowser] = useState<CookieBrowser>('none')
  // 下载选项（字幕策略由下载器统一自动处理）
  const [taskCompatibleFormat, setTaskCompatibleFormat] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false)

  const clearSubmitError = useCallback(() => setSubmitError(''), [])

  return {
    taskUrl,
    setTaskUrl,
    taskOutputDir,
    setTaskOutputDir,
    taskCookieBrowser,
    setTaskCookieBrowser,
    taskCompatibleFormat,
    setTaskCompatibleFormat,
    addingTask,
    setAddingTask,
    submitError,
    setSubmitError,
    showAddForm,
    setShowAddForm,
    directoryPickerOpen,
    setDirectoryPickerOpen,
    clearSubmitError,
  }
}
