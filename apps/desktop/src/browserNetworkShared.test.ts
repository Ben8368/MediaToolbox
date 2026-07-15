import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createBrowserNetworkId,
  resolveDownloadDirectory,
  resolveWorkspaceDirectory,
  toVirtualWorkspacePath,
  type BrowserNetworkOptions,
} from './browserNetworkShared.js'

function options(env: NodeJS.ProcessEnv = {}): BrowserNetworkOptions {
  return {
    viewId: 'browser-test',
    hostWindow: {} as BrowserNetworkOptions['hostWindow'],
    electron: {} as BrowserNetworkOptions['electron'],
    apiUrl: 'http://127.0.0.1:3701',
    rootDir: path.resolve('C:/MediaToolbox'),
    desktopAuthToken: 'test-desktop-token',
    env,
  }
}

describe('browser network IDs', () => {
  it('creates collision-resistant IDs independently of wall-clock time', () => {
    const ids = Array.from({ length: 100 }, () => createBrowserNetworkId('browser-download'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^browser-download-[0-9a-f-]{36}$/.test(id))).toBe(true)
  })
})

describe('browser network shared paths', () => {
  it('keeps browser downloads inside the workspace downloads directory', () => {
    const testOptions = options()
    expect(resolveDownloadDirectory(testOptions)).toBe(path.join(resolveWorkspaceDirectory(testOptions), 'Downloads'))
  })

  it('falls back when an explicit browser download directory escapes workspace downloads', () => {
    const testOptions = options({
      MEDIATOOLBOX_WORKSPACE_DIR: path.resolve('C:/MediaToolbox/.tmp/workspace'),
      MEDIATOOLBOX_BROWSER_DOWNLOAD_DIR: path.resolve('C:/MediaToolbox/outside-downloads'),
    })

    expect(resolveDownloadDirectory(testOptions)).toBe(path.resolve('C:/MediaToolbox/.tmp/workspace/Downloads'))
  })

  it('maps workspace download subdirectories back to virtual workspace paths', () => {
    const physicalPath = path.resolve('C:/MediaToolbox/.tmp/workspace/Downloads/Nested/file.zip')
    const testOptions = options({
      MEDIATOOLBOX_WORKSPACE_DIR: path.resolve('C:/MediaToolbox/.tmp/workspace'),
      MEDIATOOLBOX_BROWSER_DOWNLOAD_DIR: path.resolve('C:/MediaToolbox/.tmp/workspace/Downloads/Nested'),
    })

    expect(resolveDownloadDirectory(testOptions)).toBe(path.dirname(physicalPath))
    expect(toVirtualWorkspacePath(testOptions, physicalPath)).toBe('/Workspace/Downloads/Nested/file.zip')
  })
})
