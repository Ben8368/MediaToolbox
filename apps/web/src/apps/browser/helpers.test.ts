import { describe, expect, it } from 'vitest'

import type { DesktopBrowserDownloadEvent } from '@/desktopBrowser'

import {
  closeTab,
  createTab,
  downloadStatusText,
  formatBytes,
  normalizeBrowserAddress,
  patchTab,
  tabTitle,
  type BrowserTab,
} from './helpers'

function tabAt(viewId: string, overrides: Partial<BrowserTab['state']> = {}): BrowserTab {
  const tab = createTab(viewId)
  return { ...tab, state: { ...tab.state, ...overrides } }
}

function download(overrides: Partial<DesktopBrowserDownloadEvent>): DesktopBrowserDownloadEvent {
  return {
    id: 'd-1',
    viewId: 'v-1',
    sessionId: 's-1',
    sourceUrl: 'https://example.com/file.zip',
    filename: 'file.zip',
    targetPath: 'C:/Workspace/file.zip',
    status: 'running',
    receivedBytes: 0,
    totalBytes: 0,
    ...overrides,
  }
}

describe('normalizeBrowserAddress', () => {
  it('adds https for bare hosts and http for localhost', () => {
    expect(normalizeBrowserAddress('example.com')).toBe('https://example.com/')
    expect(normalizeBrowserAddress('localhost:5173')).toBe('http://localhost:5173/')
    // Pre-existing behavior: the loopback shortcut only fires for the literal
    // `localhost`/`0.0.0.0`/`[::1]` forms, so a numeric 127.x host still gets https.
    expect(normalizeBrowserAddress('127.0.0.1:8080/api')).toBe('https://127.0.0.1:8080/api')
  })

  it('rejects unsupported schemes and empty input', () => {
    expect(normalizeBrowserAddress('file:///etc/passwd')).toBeNull()
    expect(normalizeBrowserAddress('javascript:alert(1)')).toBeNull()
    expect(normalizeBrowserAddress('   ')).toBeNull()
  })

  it('passes about:blank through untouched', () => {
    expect(normalizeBrowserAddress('about:blank')).toBe('about:blank')
  })
})

describe('downloadStatusText', () => {
  it('reports terminal states', () => {
    expect(downloadStatusText(download({ status: 'succeeded' }))).toBe('已完成')
    expect(downloadStatusText(download({ status: 'canceled' }))).toBe('已取消')
    expect(downloadStatusText(download({ status: 'failed', error: '磁盘已满' }))).toBe('磁盘已满')
    expect(downloadStatusText(download({ status: 'failed' }))).toBe('下载失败')
  })

  it('reports progress by percent when total is known, else by bytes', () => {
    expect(downloadStatusText(download({ receivedBytes: 512, totalBytes: 1024 }))).toBe('下载中 50%')
    expect(downloadStatusText(download({ receivedBytes: 2048, totalBytes: 0 }))).toBe('下载中 2 KB')
  })
})

describe('formatBytes', () => {
  it('scales across units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
})

describe('patchTab', () => {
  it('patches only the matching tab and leaves others by identity', () => {
    const a = createTab('a')
    const b = createTab('b')
    const next = patchTab([a, b], 'a', { address: 'https://x' })

    expect(next[0]?.address).toBe('https://x')
    expect(next[1]).toBe(b)
  })

  it('is a no-op for an unknown viewId', () => {
    const tabs = [createTab('a')]
    expect(patchTab(tabs, 'missing', { created: true })).toEqual(tabs)
  })
})

describe('closeTab', () => {
  const tabs = [createTab('a'), createTab('b'), createTab('c')]

  it('activates the right neighbour when closing the active tab', () => {
    const result = closeTab(tabs, 'b', 'b')
    expect(result.tabs.map((t) => t.viewId)).toEqual(['a', 'c'])
    expect(result.activeId).toBe('c')
    expect(result.closed?.viewId).toBe('b')
  })

  it('falls back to the left neighbour when closing the last tab', () => {
    const result = closeTab(tabs, 'c', 'c')
    expect(result.activeId).toBe('b')
  })

  it('keeps the active id when closing a background tab', () => {
    const result = closeTab(tabs, 'a', 'c')
    expect(result.activeId).toBe('c')
    expect(result.tabs.map((t) => t.viewId)).toEqual(['b', 'c'])
  })

  it('refuses to close the final remaining tab', () => {
    const single = [createTab('only')]
    const result = closeTab(single, 'only', 'only')
    expect(result.tabs).toBe(single)
    expect(result.closed).toBeNull()
  })
})

describe('tabTitle', () => {
  it('prefers page title, then host, then placeholder', () => {
    expect(tabTitle(tabAt('v', { url: 'https://news.example.com/a', title: '早报' }))).toBe('早报')
    expect(tabTitle(tabAt('v', { url: 'https://news.example.com/a', title: 'Browser' }))).toBe('news.example.com')
    expect(tabTitle(tabAt('v'))).toBe('新标签页')
  })

  it('shows a failure label when the tab errored', () => {
    expect(tabTitle(tabAt('v', { url: 'https://x.com', error: 'boom' }))).toBe('加载失败')
  })
})
