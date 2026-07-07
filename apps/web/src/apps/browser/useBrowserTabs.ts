import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import {
  getDesktopBrowserBridge,
  type DesktopBrowserBounds,
  type DesktopBrowserDownloadEvent,
  type DesktopBrowserEvent,
  type DesktopBrowserPermissionEvent,
  type DesktopBrowserResult,
  type DesktopBrowserUploadSelection,
} from '@/desktopBrowser'
import type { DesktopWindowState } from '@/windowStore'

import {
  HOME_URL,
  closeTab as closeTabReducer,
  createTab,
  downloadStatusText,
  filterDownloadsByView,
  filterPermissionsByView,
  filterUploadsByView,
  normalizeBrowserAddress,
  patchTab,
  type BrowserStatusTone,
  type BrowserTab,
} from './helpers'

type WindowStatus = { tone: BrowserStatusTone; text: string }

const MAX_DOWNLOADS = 6
const MAX_SIDE_EVENTS = 4

export type BrowserTabsController = {
  hostRef: React.MutableRefObject<HTMLDivElement | null>
  tabs: BrowserTab[]
  activeId: string
  activeTab: BrowserTab | undefined
  status: WindowStatus
  downloads: DesktopBrowserDownloadEvent[]
  permissions: DesktopBrowserPermissionEvent[]
  uploads: DesktopBrowserUploadSelection[]
  hasBridge: boolean
  showOverlay: boolean
  openTab: () => void
  selectTab: (viewId: string) => void
  requestCloseTab: (viewId: string) => void
  setActiveAddress: (address: string) => void
  submitNavigation: (event: FormEvent) => void
  runNavigationAction: (action: 'goBack' | 'goForward' | 'reload') => void
  downloadCurrentPage: () => void
  cancelDownload: (downloadId: string) => void
  selectUploadFile: () => void
  focusActive: () => void
}

export function useBrowserTabs(browserWindow: DesktopWindowState | undefined, isActive: boolean): BrowserTabsController {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const bridge = useMemo(() => getDesktopBrowserBridge(), [])
  const windowId = browserWindow?.id ?? 'browser'
  const isVisible = Boolean(browserWindow && !browserWindow.isMinimized && isActive)

  const counterRef = useRef(1)
  const firstViewId = useMemo(() => `${windowId}::t${counterRef.current}`, [windowId])
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab(firstViewId)])
  const [activeId, setActiveId] = useState(firstViewId)
  const [status, setStatus] = useState<WindowStatus>({ tone: 'pending', text: '正在连接桌面浏览器内核' })
  const [downloads, setDownloads] = useState<DesktopBrowserDownloadEvent[]>([])
  const [permissions, setPermissions] = useState<DesktopBrowserPermissionEvent[]>([])
  const [uploads, setUploads] = useState<DesktopBrowserUploadSelection[]>([])

  // Refs mirror the latest state so the once-subscribed event listener and
  // geometry effects read fresh values without re-subscribing on every change.
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const prevActiveRef = useRef(activeId)

  const activeTab = tabs.find((tab) => tab.viewId === activeId)
  const activeDownloads = useMemo(() => filterDownloadsByView(downloads, activeId).slice(0, MAX_DOWNLOADS), [activeId, downloads])
  const activePermissions = useMemo(() => filterPermissionsByView(permissions, activeId).slice(0, MAX_SIDE_EVENTS), [activeId, permissions])
  const activeUploads = useMemo(() => filterUploadsByView(uploads, activeId).slice(0, MAX_SIDE_EVENTS), [activeId, uploads])

  const handleResult = useCallback(<T,>(result: DesktopBrowserResult<T>): T | undefined => {
    if (result.ok) return result.data
    setStatus({ tone: 'error', text: result.error })
    return undefined
  }, [])

  const patchTabState = useCallback((viewId: string, patch: Partial<BrowserTab>) => {
    setTabs((current) => patchTab(current, viewId, patch))
  }, [])

  const syncBounds = useCallback((nextVisible = isVisible) => {
    if (!bridge || !hostRef.current) return
    const active = tabsRef.current.find((tab) => tab.viewId === activeIdRef.current)
    if (!active) return
    const rect = hostRef.current.getBoundingClientRect()
    const bounds: DesktopBrowserBounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    const shouldShow = nextVisible && active.state.url !== HOME_URL && !active.state.error
    void bridge.setBounds(active.viewId, bounds, shouldShow).then(handleResult)
  }, [bridge, handleResult, isVisible])

  const ensureView = useCallback((viewId: string, markReady: boolean) => {
    if (!bridge) return
    void bridge.create(viewId, HOME_URL).then((result) => {
      const state = handleResult(result)
      if (!state) return
      patchTabState(viewId, { state, created: true })
      if (markReady) setStatus({ tone: 'ready', text: '浏览器已就绪' })
    })
  }, [bridge, handleResult, patchTabState])

  const handleEvent = useCallback((event: DesktopBrowserEvent) => {
    const owns = (viewId: string) => tabsRef.current.some((tab) => tab.viewId === viewId)

    if (event.type === 'state') {
      if (!owns(event.state.id)) return
      patchTabState(event.state.id, {
        state: event.state,
        address: event.state.url === HOME_URL ? '' : event.state.url,
      })
      if (event.state.id === activeIdRef.current) {
        setStatus(event.state.error
          ? { tone: 'error', text: event.state.error }
          : { tone: event.state.loading ? 'pending' : 'online', text: event.state.loading ? '正在载入' : '页面已载入' })
      }
      return
    }

    if (event.type === 'download') {
      if (!owns(event.download.viewId)) return
      const maxDownloads = MAX_DOWNLOADS * Math.max(tabsRef.current.length, 1)
      setDownloads((items) => [event.download, ...items.filter((item) => item.id !== event.download.id)].slice(0, maxDownloads))
      if (event.download.viewId === activeIdRef.current) {
        setStatus({ tone: event.download.status === 'failed' ? 'error' : 'online', text: downloadStatusText(event.download) })
      }
      return
    }

    if (event.type === 'permission') {
      if (!owns(event.permission.view_id)) return
      const maxEvents = MAX_SIDE_EVENTS * Math.max(tabsRef.current.length, 1)
      setPermissions((items) => [event.permission, ...items].slice(0, maxEvents))
      return
    }

    if (event.type === 'upload-selection') {
      if (!owns(event.selection.view_id)) return
      const maxEvents = MAX_SIDE_EVENTS * Math.max(tabsRef.current.length, 1)
      setUploads((items) => [event.selection, ...items].slice(0, maxEvents))
      if (event.selection.view_id === activeIdRef.current) {
        setStatus(event.selection.confirmed
          ? { tone: 'online', text: '已确认工作区上传文件' }
          : { tone: 'pending', text: '上传选择已取消' })
      }
    }
  }, [patchTabState])

  // Mount: create the first tab's native view and subscribe to bridge events once.
  useEffect(() => {
    if (!bridge) {
      setStatus({ tone: 'offline', text: '请在 MediaToolbox 桌面端中使用真浏览器' })
      return
    }
    ensureView(activeIdRef.current, true)
    const unsubscribe = bridge.onEvent(handleEvent)
    return () => {
      unsubscribe()
      for (const tab of tabsRef.current) void bridge.destroy(tab.viewId)
    }
  }, [bridge, ensureView, handleEvent])

  // When the active tab changes, hide the previous view and show the new one.
  useEffect(() => {
    const previous = prevActiveRef.current
    if (previous !== activeId && bridge) {
      const stillOpen = tabsRef.current.some((tab) => tab.viewId === previous)
      if (stillOpen) void bridge.setBounds(previous, { x: 0, y: 0, width: 0, height: 0 }, false)
    }
    prevActiveRef.current = activeId
    const frame = window.requestAnimationFrame(() => syncBounds())
    return () => window.cancelAnimationFrame(frame)
  }, [activeId, bridge, syncBounds])

  // Re-sync the active view when window geometry or the active page changes.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => syncBounds())
    return () => window.cancelAnimationFrame(frame)
  }, [
    browserWindow?.height,
    browserWindow?.isMaximized,
    browserWindow?.isMinimized,
    browserWindow?.width,
    browserWindow?.x,
    browserWindow?.y,
    browserWindow?.zIndex,
    activeTab?.state.error,
    activeTab?.state.url,
    syncBounds,
  ])

  useEffect(() => {
    if (!hostRef.current) return
    const observer = new ResizeObserver(() => syncBounds())
    const handleResize = () => syncBounds()
    observer.observe(hostRef.current)
    window.addEventListener('resize', handleResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      if (bridge) void bridge.setBounds(activeIdRef.current, { x: 0, y: 0, width: 0, height: 0 }, false)
    }
  }, [bridge, syncBounds])

  const openTab = useCallback(() => {
    counterRef.current += 1
    const viewId = `${windowId}::t${counterRef.current}`
    setTabs((current) => [...current, createTab(viewId)])
    setActiveId(viewId)
    ensureView(viewId, false)
    setStatus({ tone: 'ready', text: '已新建标签页' })
  }, [ensureView, windowId])

  const selectTab = useCallback((viewId: string) => {
    setActiveId(viewId)
    if (bridge) void bridge.focus(viewId).then(handleResult)
  }, [bridge, handleResult])

  const requestCloseTab = useCallback((viewId: string) => {
    const result = closeTabReducer(tabsRef.current, viewId, activeIdRef.current)
    if (!result.closed) return
    setTabs(result.tabs)
    setActiveId(result.activeId)
    if (bridge) void bridge.destroy(viewId)
  }, [bridge])

  const setActiveAddress = useCallback((address: string) => {
    patchTabState(activeIdRef.current, { address })
  }, [patchTabState])

  const submitNavigation = useCallback((event: FormEvent) => {
    event.preventDefault()
    const viewId = activeIdRef.current
    const current = tabsRef.current.find((tab) => tab.viewId === viewId)
    if (!bridge || !current || !current.address.trim()) return
    const nextUrl = normalizeBrowserAddress(current.address)
    if (!nextUrl) {
      setStatus({ tone: 'error', text: '仅支持 http、https 地址或 about:blank' })
      return
    }
    setStatus({ tone: 'pending', text: '正在打开页面' })
    patchTabState(viewId, { address: nextUrl === HOME_URL ? '' : nextUrl })
    void bridge.navigate(viewId, nextUrl).then((result) => {
      const state = handleResult(result)
      if (!state) return
      patchTabState(viewId, { state, address: state.url === HOME_URL ? '' : state.url })
      syncBounds(true)
    })
  }, [bridge, handleResult, patchTabState, syncBounds])

  const runNavigationAction = useCallback((action: 'goBack' | 'goForward' | 'reload') => {
    if (!bridge) return
    const viewId = activeIdRef.current
    void bridge[action](viewId).then((result) => {
      const state = handleResult(result)
      if (state) patchTabState(viewId, { state })
    })
  }, [bridge, handleResult, patchTabState])

  const downloadCurrentPage = useCallback(() => {
    if (!bridge) return
    const viewId = activeIdRef.current
    const current = tabsRef.current.find((tab) => tab.viewId === viewId)
    if (!current || current.state.url === HOME_URL || current.state.error) return
    setStatus({ tone: 'pending', text: '正在创建浏览器下载' })
    void bridge.downloadUrl(viewId, current.state.url).then((result) => {
      const state = handleResult(result)
      if (state) patchTabState(viewId, { state })
    })
  }, [bridge, handleResult, patchTabState])

  const cancelDownload = useCallback((downloadId: string) => {
    if (!bridge) return
    void bridge.cancelDownload(activeIdRef.current, downloadId).then(handleResult)
  }, [bridge, handleResult])

  const selectUploadFile = useCallback(() => {
    if (!bridge) return
    setStatus({ tone: 'pending', text: '正在选择工作区上传文件' })
    void bridge.selectUploadFile(activeIdRef.current).then(handleResult)
  }, [bridge, handleResult])

  const focusActive = useCallback(() => {
    if (bridge && isActive) void bridge.focus(activeIdRef.current)
  }, [bridge, isActive])

  const showOverlay = !bridge || !isActive || !activeTab || activeTab.state.url === HOME_URL || Boolean(activeTab.state.error)

  return {
    hostRef,
    tabs,
    activeId,
    activeTab,
    status,
    downloads: activeDownloads,
    permissions: activePermissions,
    uploads: activeUploads,
    hasBridge: Boolean(bridge),
    showOverlay,
    openTab,
    selectTab,
    requestCloseTab,
    setActiveAddress,
    submitNavigation,
    runNavigationAction,
    downloadCurrentPage,
    cancelDownload,
    selectUploadFile,
    focusActive,
  }
}
