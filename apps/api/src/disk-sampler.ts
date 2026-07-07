import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type DiskUsage = {
  total: number
  used: number
  free: number
}

export type LocalDiskCandidate = {
  name: string
  root: string
}

export type SystemDiskInfo = DiskUsage & {
  name: string
  root: string
}

export type FilebrowserDiskInfo = SystemDiskInfo & {
  path: string
  browsable: boolean
}

type WindowsLogicalDiskRow = {
  DeviceID: string
  DriveType: number
  VolumeName?: string | null
  Size: number | string
  FreeSpace: number | string
}

export async function readDiskUsage(root: string): Promise<DiskUsage | undefined> {
  const statfs = await fs.statfs(root).catch(() => undefined)
  if (!statfs || statfs.bsize <= 0 || statfs.blocks <= 0) return undefined

  const total = statfs.blocks * statfs.bsize
  const freeBlocks = statfs.bavail > 0 ? statfs.bavail : statfs.bfree
  const free = freeBlocks * statfs.bsize
  return { total, free, used: Math.max(0, total - free) }
}

export async function listSystemDisks(): Promise<SystemDiskInfo[]> {
  if (process.platform === 'win32') {
    const windowsDisks = await listWindowsLogicalDisks()
    if (windowsDisks.length > 0) return windowsDisks
  }

  const candidates = await listLocalDiskCandidates()
  const disks: SystemDiskInfo[] = []

  for (const candidate of candidates) {
    const usage = await readDiskUsage(candidate.root)
    if (!usage) continue
    disks.push({ ...candidate, ...usage })
  }

  return disks
}

export async function listLocalDiskCandidates(): Promise<LocalDiskCandidate[]> {
  if (process.platform === 'win32') {
    const drives: LocalDiskCandidate[] = []
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code)
      const root = `${letter}:\\`
      if (await isAccessible(root)) {
        drives.push({ name: formatWindowsDiskName(letter), root })
      }
    }
    return drives
  }

  if (process.platform === 'darwin') {
    const candidates: LocalDiskCandidate[] = [{ name: '系统磁盘', root: '/' }]
    const entries = await fs.readdir('/Volumes', { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith('.') || (!entry.isDirectory() && !entry.isSymbolicLink())) continue

      const root = `/Volumes/${entry.name}`
      const realRoot = await fs.realpath(root).catch(() => root)
      if (realRoot === '/') continue
      candidates.push({ name: formatVolumeDiskName(entry.name), root })
    }
    return candidates
  }

  return [{ name: '系统磁盘', root: path.parse(process.cwd()).root || '/' }]
}

export function findHostingDiskRoot(physicalPath: string, candidates: LocalDiskCandidate[]): string {
  const normalized = path.resolve(physicalPath)

  if (process.platform === 'win32') {
    const match = normalized.match(/^([A-Za-z]:)/i)
    return match ? `${match[1]!.toUpperCase()}\\` : candidates[0]?.root ?? normalized
  }

  let best = ''
  for (const candidate of candidates) {
    const root = path.resolve(candidate.root)
    if (normalized === root || normalized.startsWith(`${root}${path.sep}`)) {
      if (root.length > best.length) best = root
    }
  }

  if (best) return best
  return path.parse(normalized).root || '/'
}

export function formatFallbackDiskName(root: string): string {
  if (process.platform === 'win32') {
    const letter = root.match(/^([A-Za-z]):/i)?.[1]
    return letter ? formatWindowsDiskName(letter) : '本地磁盘'
  }

  const base = path.basename(root.replace(/[\\/]+$/, '')) || root
  return formatVolumeDiskName(base)
}

export async function buildFilebrowserDisks(input: {
  workspaceVirtualPath: string
  physicalWorkspaceRoot: string
  systemDisks?: SystemDiskInfo[]
}): Promise<FilebrowserDiskInfo[]> {
  const disks = input.systemDisks ?? await listSystemDisks()
  if (disks.length === 0) {
    const fallbackRoot = path.parse(path.resolve(input.physicalWorkspaceRoot)).root || path.parse(process.cwd()).root || '/'
    const usage = await readDiskUsage(fallbackRoot)
    if (usage) {
      return [{
        name: formatFallbackDiskName(fallbackRoot),
        root: fallbackRoot,
        ...usage,
        path: input.workspaceVirtualPath,
        browsable: true,
      }]
    }
  }
  if (disks.length === 0) return []

  const hostRoot = findHostingDiskRoot(
    input.physicalWorkspaceRoot,
    disks.map((disk) => ({ name: disk.name, root: disk.root })),
  )

  return disks.map((disk) => {
    const isWorkspaceHost = sameDiskRoot(disk.root, hostRoot)
    return {
      ...disk,
      path: isWorkspaceHost ? input.workspaceVirtualPath : disk.root,
      browsable: isWorkspaceHost,
    }
  })
}

export function parseWindowsLogicalDiskJson(stdout: string): WindowsLogicalDiskRow[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  const parsed = JSON.parse(trimmed) as WindowsLogicalDiskRow | WindowsLogicalDiskRow[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

export function mapWindowsLogicalDisk(row: WindowsLogicalDiskRow): SystemDiskInfo | undefined {
  const deviceId = row.DeviceID?.trim()
  if (!deviceId) return undefined

  const total = Number(row.Size)
  const free = Number(row.FreeSpace)
  if (!Number.isFinite(total) || !Number.isFinite(free) || total <= 0) return undefined

  return {
    name: formatWindowsDiskNameByType(row.DriveType, deviceId, row.VolumeName),
    root: deviceId.endsWith('\\') ? deviceId : `${deviceId}\\`,
    total,
    free,
    used: Math.max(0, total - free),
  }
}

async function listWindowsLogicalDisks(): Promise<SystemDiskInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3,4 -and $_.DeviceID } | Select-Object DeviceID, DriveType, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress",
      ],
      { timeout: 5000, windowsHide: true },
    )

    return parseWindowsLogicalDiskJson(stdout)
      .map((row) => mapWindowsLogicalDisk(row))
      .filter((disk): disk is SystemDiskInfo => Boolean(disk))
      .sort(compareDiskRoots)
  } catch {
    return []
  }
}

function formatWindowsDiskName(letter: string): string {
  return `本地磁盘 (${letter.toUpperCase()}:)`
}

function formatWindowsDiskNameByType(driveType: number, deviceId: string, volumeName?: string | null): string {
  if (driveType === 4) return `SMB 磁盘 (${deviceId})`
  if (driveType === 2) return `可移动磁盘 (${deviceId})`
  if (volumeName?.trim()) return `本地磁盘 (${deviceId})`
  return `本地磁盘 (${deviceId})`
}

function formatVolumeDiskName(label: string): string {
  return `本地磁盘 (${label})`
}

function sameDiskRoot(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function compareDiskRoots(left: SystemDiskInfo, right: SystemDiskInfo): number {
  return left.root.localeCompare(right.root, undefined, { sensitivity: 'base' })
}

async function isAccessible(target: string): Promise<boolean> {
  return fs.access(target).then(() => true).catch(() => false)
}
