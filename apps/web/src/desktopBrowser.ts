export type DesktopBrowserBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type DesktopBrowserState = {
  id: string
  sessionId: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: string
}

export type DesktopBrowserSessionScope = 'default' | 'isolated'

export type DesktopBrowserRequestDraft = {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  headers?: Record<string, string>
  body?: string
}

export type DesktopBrowserRequestResult = {
  id: string
  url: string
  method: string
  status: number
  headers: Record<string, string>
  body: string
  truncated: boolean
}

export type DesktopBrowserDownloadEvent = {
  id: string
  viewId: string
  sessionId: string
  sourceUrl: string
  filename: string
  targetPath: string
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  receivedBytes: number
  totalBytes: number
  error?: string
}

export type DesktopBrowserPermissionEvent = {
  view_id: string
  session_id: string
  origin: string
  permission: string
  decision: 'granted' | 'denied'
  reason?: string
}

export type DesktopBrowserUploadSelection = {
  view_id: string
  session_id: string
  filename: string
  path: string
  size: number
  confirmed: boolean
}

export type DesktopBrowserRequestEvent = {
  id: string
  viewId: string
  sessionId: string
  url: string
  method: string
  status: 'running' | 'succeeded' | 'failed' | 'canceled'
  responseStatus?: number
  responseBytes: number
  error?: string
}

export type DesktopBrowserEvent =
  | {
      type: 'state'
      state: DesktopBrowserState
    }
  | {
      type: 'download'
      download: DesktopBrowserDownloadEvent
    }
  | {
      type: 'permission'
      permission: DesktopBrowserPermissionEvent
    }
  | {
      type: 'upload-selection'
      selection: DesktopBrowserUploadSelection
    }
  | {
      type: 'request'
      request: DesktopBrowserRequestEvent
    }

export type DesktopBrowserResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type DesktopBrowserBridge = {
  create: (id: string, url?: string, options?: { sessionScope?: DesktopBrowserSessionScope }) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  destroy: (id: string) => Promise<DesktopBrowserResult<{ id: string }>>
  setBounds: (id: string, bounds: DesktopBrowserBounds, visible: boolean) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  navigate: (id: string, url: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  goBack: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  goForward: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  reload: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  focus: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  downloadUrl: (id: string, url?: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  request: (id: string, draft: DesktopBrowserRequestDraft) => Promise<DesktopBrowserResult<DesktopBrowserRequestResult>>
  cancelDownload: (id: string, downloadId: string) => Promise<DesktopBrowserResult<{ id: string; canceled: boolean }>>
  selectUploadFile: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserUploadSelection | null>>
  onEvent: (listener: (event: DesktopBrowserEvent) => void) => () => void
}

declare global {
  interface Window {
    mediaToolboxDesktop?: {
      browser?: DesktopBrowserBridge
    }
  }
}

export function getDesktopBrowserBridge(): DesktopBrowserBridge | undefined {
  return window.mediaToolboxDesktop?.browser
}
