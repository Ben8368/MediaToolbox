import { useCallback, useEffect, useMemo, useState } from 'react'

import type { CookieBrowser, DownloadPlatform, SubtitleFormat } from '@/apps/downloader/types'
import { getPlatformOption } from '@/apps/downloader/helpers'

export function useDownloaderForm() {
  const [taskUrl, setTaskUrl] = useState('')
  const [taskPlatform, setTaskPlatform] = useState<DownloadPlatform>('auto')
  const [taskSubtitles, setTaskSubtitles] = useState(true)
  const [taskOutputDir, setTaskOutputDir] = useState('')
  const [taskCookieBrowser, setTaskCookieBrowser] = useState<CookieBrowser>('none')
  // 下载选项（默认值即"最高规格 H264 + SRT 字幕"）
  const [taskPreferH264, setTaskPreferH264] = useState(true)
  const [taskNoTranscode, setTaskNoTranscode] = useState(false)
  const [taskSubtitleFormat, setTaskSubtitleFormat] = useState<SubtitleFormat>('srt')
  const [addingTask, setAddingTask] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false)

  const selectedPlatform = useMemo(() => getPlatformOption(taskPlatform), [taskPlatform])

  useEffect(() => {
    if (!selectedPlatform.supportsSubtitles && taskSubtitles) {
      setTaskSubtitles(false)
    }
  }, [selectedPlatform.supportsSubtitles, taskSubtitles])

  const clearSubmitError = useCallback(() => setSubmitError(''), [])

  return {
    taskUrl,
    setTaskUrl,
    taskPlatform,
    setTaskPlatform,
    taskSubtitles,
    setTaskSubtitles,
    taskOutputDir,
    setTaskOutputDir,
    taskCookieBrowser,
    setTaskCookieBrowser,
    taskPreferH264,
    setTaskPreferH264,
    taskNoTranscode,
    setTaskNoTranscode,
    taskSubtitleFormat,
    setTaskSubtitleFormat,
    addingTask,
    setAddingTask,
    submitError,
    setSubmitError,
    showAddForm,
    setShowAddForm,
    directoryPickerOpen,
    setDirectoryPickerOpen,
    selectedPlatform,
    clearSubmitError,
  }
}
