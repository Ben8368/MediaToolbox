export type DesktopBrowserBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type DesktopBrowserState = {
  id: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: string
}

export type DesktopBrowserEvent = {
  type: 'state'
  state: DesktopBrowserState
}

export type DesktopBrowserResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type DesktopBrowserBridge = {
  create: (id: string, url?: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  destroy: (id: string) => Promise<DesktopBrowserResult<{ id: string }>>
  setBounds: (id: string, bounds: DesktopBrowserBounds, visible: boolean) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  navigate: (id: string, url: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  goBack: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  goForward: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  reload: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
  focus: (id: string) => Promise<DesktopBrowserResult<DesktopBrowserState>>
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
