// Simplified DownloaderApp for v2 - AI features removed
import { useCallback, useEffect, useMemo, useState } from 'react'

import { analyzeDownloadStrategy, submitFetch } from '@/api'
import { getDesktopBrowserBridge } from '@/desktopBrowser'
import { DownloaderAddForm } from '@/apps/downloader/DownloaderAddForm'
import { DownloaderDetailDrawer } from '@/apps/downloader/DownloaderDetailDrawer'
import {
  createOptimisticTask,
  extractTaskDetailRows,
  extractTaskRequestSnapshot,
  mergeTasks,
} from '@/apps/downloader/helpers'
import { DownloaderSidebar } from '@/apps/downloader/DownloaderSidebar'
import { DownloaderStatusBar } from '@/apps/downloader/DownloaderStatusBar'
import { DownloaderTaskTable } from '@/apps/downloader/DownloaderTaskTable'
import { DownloaderToolbar } from '@/apps/downloader/DownloaderToolbar'
import { useDownloaderActions } from '@/apps/downloader/useDownloaderActions'
import { useDownloaderForm } from '@/apps/downloader/useDownloaderForm'
import { useDownloaderSelection } from '@/apps/downloader/useDownloaderSelection'
import { useDownloaderTaskData } from '@/apps/downloader/useDownloaderTaskData'
import { DirectoryPickerDialog } from '@/apps/FileManagerApp'
import type { CookieBrowser } from '@/apps/downloader/types'
import type { FetchTaskDraft } from '@mediatoolbox/contracts'

const COOKIE_BROWSER_LABELS: Record<CookieBrowser, string> = {
  none: '不使用浏览器登录态',
  chrome: 'Chrome',
  edge: 'Edge',
  safari: 'Safari',
  firefox: 'Firefox',
}

const BROWSER_DOWNLOAD_CHANNEL_ID = 'download-browser-channel'

export function DownloaderApp() {
  const { historyTasks, queueTasks, mergedTasks, pollError, fetchHistoryTasks, refreshLists, setOptimisticTasks } = useDownloaderTaskData()

  const form = useDownloaderForm()
  const selection = useDownloaderSelection({ mergedTasks, historyTasks, queueTasks })
  const actions = useDownloaderActions({
    selectedTasks: selection.selectedTasks,
    selectedClearableTasks: selection.selectedClearableTasks,
    refreshLists,
    setOptimisticTasks,
    onOptimisticTaskCreated: (task) => selection.setSelectedTaskId(task.id),
  })

  // Fetch history when viewing history-related categories
  useEffect(() => {
    if (['completed', 'paused', 'error'].includes(selection.selectedCategory)) {
      void fetchHistoryTasks()
    }
  }, [fetchHistoryTasks, selection.selectedCategory])

  // Submit task payloads (shared by single-URL and multi-URL paths)
  const submitTaskPayloads = useCallback(
    async (urls: string[]) => {
      const draft: FetchTaskDraft = {
        urls: urls,
        output_dir: form.taskOutputDir || '/Workspace/Downloads',
        compatible_format: form.taskCompatibleFormat,
        max_concurrent: 1,
        ...(form.taskCookieBrowser !== 'none' ? { cookies_from_browser: form.taskCookieBrowser } : {}),
      }

      const result = await submitFetch(draft)
      if (!result || !result.task_id) {
        throw new Error('服务器未返回任务 ID')
      }

      const taskIds = result.task_ids?.length ? result.task_ids : [result.task_id]
      const optimisticTasks = taskIds.map((taskId, index) => {
        const url = urls[index] ?? urls[0] ?? ''
        return createOptimisticTask(url, { ...draft, url, urls: [url] }, { ...result, task_id: taskId })
      })
      setOptimisticTasks((prev) => mergeTasks(optimisticTasks, prev))
      selection.setSelectedTaskId(optimisticTasks[0]?.id ?? result.task_id)
      selection.clearSelection()
      selection.setSelectedCategory('all')
      void refreshLists()
    },
    [
      form.taskCookieBrowser,
      form.taskOutputDir,
      form.taskCompatibleFormat,
      refreshLists,
      setOptimisticTasks,
      selection,
    ],
  )

  const submitBrowserDownloads = useCallback(async (urls: string[]) => {
    const bridge = getDesktopBrowserBridge()
    if (!bridge) throw new Error('浏览器资源下载需要在 MediaToolbox 桌面端中使用。')
    const channel = await bridge.create(BROWSER_DOWNLOAD_CHANNEL_ID, 'about:blank', { sessionScope: 'default' })
    if (!channel.ok) throw new Error(channel.error)
    for (const url of urls) {
      const result = await bridge.downloadUrl(BROWSER_DOWNLOAD_CHANNEL_ID, url)
      if (!result.ok) throw new Error(result.error)
    }
    void refreshLists()
  }, [refreshLists])

  const submitNewTask = useCallback(async () => {
    if (!form.taskUrl.trim() || form.addingTask) return
    form.setAddingTask(true)
    form.setSubmitError('')
    actions.setActionError('')
    try {
      const urls = form.taskUrl
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0)

      const analyses = await Promise.all(urls.map((url) => analyzeDownloadStrategy({ url })))
      const browserUrls = urls.filter((_url, index) => analyses[index]?.analysis?.route === 'browser')
      const ytdlpUrls = urls.filter((_url, index) => analyses[index]?.analysis?.route !== 'browser')
      if (ytdlpUrls.length) await submitTaskPayloads(ytdlpUrls)
      if (browserUrls.length) await submitBrowserDownloads(browserUrls)
      form.setTaskUrl('')
      form.setShowAddForm(false)
    } catch (err: unknown) {
      form.setSubmitError(err instanceof Error ? err.message : '下载任务提交失败')
    } finally {
      form.setAddingTask(false)
    }
  }, [form, submitTaskPayloads, submitBrowserDownloads, actions, refreshLists])

  const confirmCookieBrowserChange = useCallback(
    (browser: CookieBrowser) => {
      if (browser === 'none') {
        form.setTaskCookieBrowser(browser)
        return
      }
      const label = COOKIE_BROWSER_LABELS[browser]
      const confirmed = window.confirm(
        `使用 ${label} 登录态前，需要你先自行完全退出 ${label}。MediaTools 不会自动关闭已经打开的浏览器。确认使用 ${label} 登录态？`,
      )
      if (confirmed) {
        form.setTaskCookieBrowser(browser)
      }
    },
    [form],
  )

  // Detail drawer derived data
  const detailRows = useMemo(() => (selection.selectedTask ? extractTaskDetailRows(selection.selectedTask) : []), [selection.selectedTask])
  const detailSnapshot = useMemo(() => {
    if (!selection.selectedTask) return ''
    const snapshot = extractTaskRequestSnapshot(selection.selectedTask)
    return typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot, null, 2)
  }, [selection.selectedTask])
  const detailState = useMemo(() => selection.selectedTask?.state ? JSON.stringify(selection.selectedTask.state, null, 2) : '', [selection.selectedTask?.state])
  const detailResult = useMemo(() => selection.selectedTask?.result ? JSON.stringify(selection.selectedTask.result, null, 2) : '', [selection.selectedTask?.result])

  const [detailOpen, setDetailOpen] = useState(false)

  return (
    <div className="dl-app">
      <DownloaderSidebar
        selectedCategory={selection.selectedCategory}
        stats={selection.stats}
        miniAiOpen={false}
        onToggleMiniAi={() => {}}
        onSelectCategory={(category) => {
          selection.setSelectedCategory(category)
          selection.clearSelection()
        }}
      />

      <main className={`dl-panel ${form.showAddForm ? 'dl-panel--with-form' : ''}`}>
        <DownloaderToolbar
          showAddForm={form.showAddForm}
          onToggleAddForm={() => form.setShowAddForm((prev) => !prev)}
          canStopSelected={selection.canStopSelected}
          onStopSelected={actions.stopSelected}
          canRetrySelected={selection.canRetrySelected}
          onRetrySelected={() => {
            actions.retrySelected().then(() => {
              selection.clearSelection()
              selection.setSelectedCategory('all')
            })
          }}
          canSelectAllVisible={selection.canSelectAllVisible}
          allVisibleSelected={selection.allVisibleSelected}
          onToggleSelectAll={selection.toggleSelectAllVisible}
          canClearRecords={selection.canClearRecords}
          clearRecordsTitle={selection.clearRecordsTitle}
          onClearRecords={() => {
            actions.clearRecords().then(() => {
              selection.clearSelection()
              selection.setSelectedTaskId(null)
            })
          }}
          searchText={selection.searchText}
          onSearchTextChange={selection.setSearchText}
        />

        <div className="dl-stage">
          {form.showAddForm && (
            <DownloaderAddForm
              taskUrl={form.taskUrl}
              taskOutputDir={form.taskOutputDir}
              taskCookieBrowser={form.taskCookieBrowser}
              taskCompatibleFormat={form.taskCompatibleFormat}
              addingTask={form.addingTask}
              submitError={form.submitError}
              onTaskUrlChange={form.setTaskUrl}
              onTaskOutputDirChange={form.setTaskOutputDir}
              onTaskCookieBrowserChange={confirmCookieBrowserChange}
              onTaskCompatibleFormatChange={form.setTaskCompatibleFormat}
              onOpenDirectoryPicker={() => form.setDirectoryPickerOpen(true)}
              onSubmit={submitNewTask}
              onClose={() => {
                form.setShowAddForm(false)
                form.clearSubmitError()
              }}
            />
          )}

          <DownloaderTaskTable
            filteredTasks={selection.filteredTasks}
            selectedTaskId={selection.selectedTaskId}
            selectedIds={selection.selectedIds}
            onRowClick={selection.handleRowClick}
            onRowMenuAction={actions.handleRowMenuAction}
          />

          {(actions.actionError || pollError) && (
            <div className="dl-action-error">{actions.actionError || pollError}</div>
          )}
        </div>

        <DownloaderStatusBar detailOpen={detailOpen} onToggleDetail={() => setDetailOpen((prev) => !prev)} />
      </main>

      <DownloaderDetailDrawer
        open={detailOpen}
        selectedTask={selection.selectedTask}
        detailRows={detailRows}
        detailRequest={detailSnapshot}
        detailState={detailState}
        detailResult={detailResult}
        actionError={actions.actionError}
        onClose={() => setDetailOpen(false)}
      />

      <DirectoryPickerDialog
        open={form.directoryPickerOpen}
        value={form.taskOutputDir}
        mode="directory"
        title="选择下载保存目录"
        confirmLabel="使用此目录"
        onClose={() => form.setDirectoryPickerOpen(false)}
        onPick={form.setTaskOutputDir}
      />
    </div>
  )
}
