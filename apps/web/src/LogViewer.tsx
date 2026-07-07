import { useCallback, useEffect, useMemo, useState } from 'react'

import { getApiRuntimePresentation } from '@/api/runtime'
import {
  clearLogs,
  clearNotifications,
  fetchLogMetadata,
  fetchLogs,
  fetchNotifications,
  getSystemMetrics,
  markAllNotificationsAsRead,
} from '@/api'
import { useLogViewerStore } from '@/logViewerStore'
import { useNotificationUnreadStore } from '@/notificationUnreadStore'
import { getErrorMessage } from '@/utils'

type LogEntry = {
  level: string
  module: string
  time: string
  user?: string
  event?: string
  message: string
}

type LogResponse = {
  ok?: boolean
  total: number
  items: LogEntry[]
  page: number
  page_size: number
  levels?: string[]
}

const LEVEL_LABELS: Record<string, string> = {
  DEBUG: 'Debug',
  INFO: '信息',
  NOTICE: '通知',
  WARNING: '警告',
  ERROR: '错误',
  CRITICAL: '严重',
}

const PRODUCTION_LEVELS = ['NOTICE', 'WARNING', 'ERROR', 'CRITICAL']
const DEVELOPMENT_LEVELS = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL']
const NOTIFICATION_LEVELS = ['WARNING', 'ERROR', 'CRITICAL']

export function LogViewer() {
  const runtime = getApiRuntimePresentation()
  const activePanel = useLogViewerStore((s) => s.activePanel)
  const setActivePanel = useLogViewerStore((s) => s.setActivePanel)
  const [logs, setLogs] = useState<LogResponse>({ total: 0, items: [], page: 1, page_size: 50 })
  const [level, setLevel] = useState('NOTICE')
  const [module, setModule] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [jumpPage, setJumpPage] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logMode, setLogMode] = useState<'production' | 'development'>('production')
  const pullUnreadNotificationCount = useNotificationUnreadStore((s) => s.pullUnreadNotificationCount)
  const setUnreadNotificationCount = useNotificationUnreadStore((s) => s.setUnreadNotificationCount)
  const setClearCooldown = useNotificationUnreadStore((s) => s.setClearCooldown)

  const isNotificationPanel = activePanel === 'notifications'
  const availableLevels = isNotificationPanel
    ? NOTIFICATION_LEVELS
    : (logMode === 'development' ? DEVELOPMENT_LEVELS : PRODUCTION_LEVELS)

  const totalPages = Math.max(Math.ceil((logs.total || 0) / pageSize), 1)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = isNotificationPanel
        ? await fetchNotifications({ level, page, page_size: pageSize }) as LogResponse
        : await fetchLogs({ level, module, page, page_size: pageSize }) as LogResponse
      setLogs({
        ...data,
        total: data.total ?? 0,
        items: data.items ?? [],
        page: data.page ?? page,
        page_size: data.page_size ?? pageSize,
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err) || (isNotificationPanel ? '通知加载失败' : '日志加载失败'))
    } finally {
      setLoading(false)
    }
  }, [isNotificationPanel, level, module, page, pageSize])

  const loadMetadata = useCallback(async () => {
    try {
      const data = await fetchLogMetadata()
      setModules(data?.modules || [])
    } catch {
      setModules([])
    }
  }, [])

  useEffect(() => {
    async function loadMetricsAndLogs() {
      try {
        const metrics = await getSystemMetrics()
        const mode = metrics?.log_mode === 'development' ? 'development' : 'production'
        setLogMode(mode)
        if (mode === 'production' && activePanel === 'logs') {
          setLevel('NOTICE')
        }
      } catch {
        setLogMode('production')
      }
    }
    void loadMetricsAndLogs()
  }, [activePanel])

  useEffect(() => {
    void pullUnreadNotificationCount()
  }, [pullUnreadNotificationCount])

  useEffect(() => {
    if (isNotificationPanel) {
      setLevel('WARNING')
      setModule('')
      setPage(1)
      return
    }
    setLevel(logMode === 'development' ? 'DEBUG' : 'NOTICE')
  }, [isNotificationPanel, logMode])

  useEffect(() => {
    void loadLogs()
    void loadMetadata()
    const timer = window.setInterval(() => {
      void loadLogs()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [loadLogs, loadMetadata])

  const pages = useMemo(() => buildPages(page, totalPages), [page, totalPages])

  async function handleClear() {
    try {
      if (isNotificationPanel) {
        await markAllNotificationsAsRead()
        await clearNotifications()
        setUnreadNotificationCount(0)
        setClearCooldown()
      } else {
        await markAllNotificationsAsRead()
        await clearNotifications()
        await clearLogs()
        setUnreadNotificationCount(0)
        setClearCooldown()
        setPage(1)
        await loadMetadata()
      }
      await loadLogs()
    } finally {
      await pullUnreadNotificationCount()
    }
  }

  function changeLevel(value: string) {
    setLevel(value)
    setPage(1)
  }

  function changeModule(value: string) {
    setModule(value)
    setPage(1)
  }

  function switchPanel(panel: 'notifications' | 'logs') {
    setActivePanel(panel)
    setPage(1)
    setError('')
  }

  function commitJump() {
    const next = Number(jumpPage)
    if (!Number.isFinite(next)) return
    setPage(Math.min(Math.max(Math.trunc(next), 1), totalPages))
    setJumpPage('')
  }

  return (
    <div className="lv-app">
      <section className="lv-panel">
        <div className="lv-toolbar">
          <div>
            <h2>{isNotificationPanel ? '通知中心' : '日志'}</h2>
            <p>{isNotificationPanel ? '查看警告、错误和严重事件。打开后新通知会显示在左侧角标。' : runtime.logsDescription}</p>
          </div>
          <div className="lv-tabs">
            <button
              type="button"
              className={`lv-tab ${isNotificationPanel ? 'lv-tab--active' : ''}`}
              onClick={() => switchPanel('notifications')}
            >
              通知
            </button>
            <button
              type="button"
              className={`lv-tab ${!isNotificationPanel ? 'lv-tab--active' : ''}`}
              onClick={() => switchPanel('logs')}
            >
              日志
            </button>
          </div>
          <button className="lv-refresh" title="刷新" onClick={() => void loadLogs()}><RefreshIcon /></button>
        </div>

        <div className="lv-filters">
          <label className="lv-filter">
            <span>等级</span>
            <select value={level} onChange={(event) => changeLevel(event.target.value)}>
              {availableLevels.map((item) => <option key={item} value={item}>{LEVEL_LABELS[item]}</option>)}
            </select>
          </label>
          {!isNotificationPanel && (
            <label className="lv-filter">
              <span>模块</span>
              <select value={module} onChange={(event) => changeModule(event.target.value)}>
                <option value="">全部</option>
                {modules.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          )}
          <span className="lv-spacer" />
          <button className="lv-action" onClick={() => void handleClear()}>
            <ClearIcon />
            {isNotificationPanel ? '全部标为已读' : '清空'}
          </button>
          <button className="lv-action"><MoreIcon />更多</button>
        </div>

        <div className="lv-table">
          <div className="lv-head">
            <span>等级</span>
            <span>模块</span>
            <span>时间</span>
            <span>用户</span>
            <span>事件</span>
          </div>

          <div className="lv-body">
            {logs.items.map((log, index) => (
              <div className="lv-row" key={`${log.time}-${log.module}-${index}`}>
                <span className={`lv-level lv-level--${log.level.toLowerCase()}`}>{LEVEL_LABELS[log.level] || log.level}</span>
                <strong>{log.module}</strong>
                <span>{log.time}</span>
                <span>{log.user || 'system'}</span>
                <p>{log.event || log.message}</p>
              </div>
            ))}
            {loading && <div className="lv-empty">正在刷新{isNotificationPanel ? '通知' : '日志'}...</div>}
            {!loading && error && <div className="lv-empty lv-empty--error">{error}</div>}
            {!loading && !error && logs.items.length === 0 && (
              <div className="lv-empty">{isNotificationPanel ? '暂无通知' : '暂无日志'}</div>
            )}
          </div>
        </div>

        <footer className="lv-footer">
          <button className="lv-refresh" title="刷新" onClick={() => void loadLogs()}><RefreshIcon /></button>
          <span>共 {logs.total} 项</span>
          <div className="lv-pages">
            <PageButton disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}><BackIcon /></PageButton>
            {pages.map((item, index) => item === '...'
              ? <span className="lv-ellipsis" key={`ellipsis-${index}`}>...</span>
              : <PageButton active={item === page} key={item} onClick={() => setPage(item)}>{item}</PageButton>
            )}
            <PageButton disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}><ForwardIcon /></PageButton>
          </div>
          <label className="lv-page-size">
            每页条数:
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
          <label className="lv-jump">
            跳至
            <input value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitJump() }} />
            页
          </label>
        </footer>
      </section>
    </div>
  )
}

function buildPages(page: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const items = new Set([1, 2, 3, totalPages - 1, totalPages, page - 1, page, page + 1])
  const sorted = Array.from(items).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b)
  const result: Array<number | '...'> = []
  sorted.forEach((item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) result.push('...')
    result.push(item)
  })
  return result
}

function PageButton({ children, active, disabled, onClick }: { children: React.ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return <button className={`lv-page ${active ? 'lv-page--active' : ''}`} disabled={disabled} onClick={onClick}>{children}</button>
}

const ClearIcon = () => <svg viewBox="0 0 24 24"><path d="M5 8h14" /><path d="M9 8V5h6v3" /><path d="M8 8l1 11h6l1-11" /></svg>
const MoreIcon = () => <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" /></svg>
const RefreshIcon = () => <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
const BackIcon = () => <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
const ForwardIcon = () => <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
