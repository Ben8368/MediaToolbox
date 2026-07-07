import { describe, expect, it } from 'vitest'
import path from 'node:path'

import {
  buildFilebrowserDisks,
  findHostingDiskRoot,
  formatFallbackDiskName,
  mapWindowsLogicalDisk,
  parseWindowsLogicalDiskJson,
  type LocalDiskCandidate,
} from './disk-sampler.js'

const windowsCandidates: LocalDiskCandidate[] = [
  { name: '本地磁盘 (C:)', root: 'C:\\' },
  { name: '本地磁盘 (D:)', root: 'D:\\' },
]

describe('disk sampler', () => {
  it.skipIf(process.platform !== 'win32')('resolves the hosting Windows drive from a workspace path', () => {
    expect(findHostingDiskRoot('C:\\MediaToolbox\\.tmp\\workspace', windowsCandidates)).toBe('C:\\')
    expect(findHostingDiskRoot('D:\\Projects\\workspace', windowsCandidates)).toBe('D:\\')
  })

  it('formats fallback disk names for platform-specific roots', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(formatFallbackDiskName('C:\\')).toBe('本地磁盘 (C:)')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    expect(formatFallbackDiskName('/Volumes/Data')).toBe('本地磁盘 (Data)')
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('parses Windows logical disk JSON payloads', () => {
    const rows = parseWindowsLogicalDiskJson(
      JSON.stringify([
        { DeviceID: 'C:', DriveType: 3, VolumeName: 'System', Size: 1024, FreeSpace: 256 },
        { DeviceID: 'Z:', DriveType: 4, VolumeName: 'Share', Size: 2048, FreeSpace: 512 },
      ]),
    )

    expect(rows).toHaveLength(2)
    expect(mapWindowsLogicalDisk(rows[0]!)).toMatchObject({
      name: '本地磁盘 (C:)',
      root: 'C:\\',
      total: 1024,
      free: 256,
      used: 768,
    })
    expect(mapWindowsLogicalDisk(rows[1]!)).toMatchObject({
      name: 'SMB 磁盘 (Z:)',
      root: 'Z:\\',
      total: 2048,
      free: 512,
      used: 1536,
    })
  })

  it('marks the workspace hosting disk as browsable and keeps other devices visible', async () => {
    const hostRoot = path.parse(path.resolve(process.cwd())).root
    const otherRoot = process.platform === 'win32' ? 'Z:\\' : '/Volumes/External'
    const disks = await buildFilebrowserDisks({
      workspaceVirtualPath: '/Workspace',
      physicalWorkspaceRoot: process.cwd(),
      systemDisks: [
        { name: '系统磁盘', root: hostRoot, total: 1024, free: 512, used: 512 },
        { name: '本地磁盘 (External)', root: otherRoot, total: 2048, free: 1024, used: 1024 },
      ],
    })

    expect(disks).toEqual([
      { name: '系统磁盘', root: hostRoot, total: 1024, free: 512, used: 512, path: '/Workspace', browsable: true },
      { name: '本地磁盘 (External)', root: otherRoot, total: 2048, free: 1024, used: 1024, path: otherRoot, browsable: false },
    ])
  })

  it('falls back to the workspace host volume when system disk discovery is empty', async () => {
    const disks = await buildFilebrowserDisks({
      workspaceVirtualPath: '/Workspace',
      physicalWorkspaceRoot: process.cwd(),
      systemDisks: [],
    })

    expect(disks.length).toBeGreaterThan(0)
    expect(disks[0]).toMatchObject({ path: '/Workspace', browsable: true })
    expect(disks[0]?.total).toBeGreaterThan(0)
  })

  it.skipIf(process.platform !== 'win32')('builds filebrowser disks for all system volumes', async () => {
    const disks = await buildFilebrowserDisks({
      workspaceVirtualPath: '/Workspace',
      physicalWorkspaceRoot: process.cwd(),
    })

    expect(disks.length).toBeGreaterThan(0)
    expect(disks.some((disk) => disk.browsable && disk.path === '/Workspace')).toBe(true)
    expect(disks.every((disk) => disk.total > 0 && disk.free >= 0 && disk.used >= 0)).toBe(true)

    if (process.platform === 'win32') {
      expect(disks.length).toBeGreaterThanOrEqual(2)
    }
  })
})
