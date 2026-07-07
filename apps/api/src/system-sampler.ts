import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import type { BrowserNetworkDownloadRecord, BrowserNetworkRequestRecord, FetchTaskRecord } from '@mediatoolbox/contracts'

const execFileAsync = promisify(execFile)
const GPU_CACHE_MS = 2000

type CpuTotals = { idle: number; total: number }

export type GpuSnapshot = {
  percent: number
  available: boolean
  detail: string
}

export type ProjectNetworkSample = {
  at: number
  browserReceivedBytes: number
  browserResponseBytes: number
  browserRequestBytes: number
}

export type ProjectNetworkRates = {
  uploadBytesPerSec: number
  downloadBytesPerSec: number
  nextSample: ProjectNetworkSample
}

let cpuPrevious: CpuTotals | null = null
let gpuCache: { at: number; snapshot: GpuSnapshot } | null = null
let gpuInflight: Promise<GpuSnapshot> | null = null

function readCpuTotals(): CpuTotals {
  return os.cpus().reduce(
    (acc, cpu) => {
      const times = cpu.times
      return {
        idle: acc.idle + times.idle,
        total: acc.total + times.user + times.nice + times.sys + times.idle + times.irq,
      }
    },
    { idle: 0, total: 0 },
  )
}

export function sampleCpuPercent(): number {
  const current = readCpuTotals()
  if (!cpuPrevious) {
    cpuPrevious = current
    return 0
  }

  const idleDelta = current.idle - cpuPrevious.idle
  const totalDelta = current.total - cpuPrevious.total
  cpuPrevious = current
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
}

export function resetCpuSamplerForTests(): void {
  cpuPrevious = null
  gpuCache = null
  gpuInflight = null
}

export async function sampleGpu(): Promise<GpuSnapshot> {
  const now = Date.now()
  if (gpuCache && now - gpuCache.at < GPU_CACHE_MS) return gpuCache.snapshot
  if (gpuInflight) return gpuInflight

  gpuInflight = readGpuUtilization()
    .then((snapshot) => {
      gpuCache = { at: Date.now(), snapshot }
      return snapshot
    })
    .finally(() => {
      gpuInflight = null
    })
  return gpuInflight
}

async function readGpuUtilization(): Promise<GpuSnapshot> {
  const nvidia = await readNvidiaSmiUtilization()
  if (nvidia) return nvidia

  if (process.platform === 'win32') {
    const counter = await readWindowsGpuCounter()
    if (counter) return counter
    return { percent: 0, available: false, detail: '未检测到可用 GPU 利用率计数器。' }
  }

  return { percent: 0, available: false, detail: '当前平台仅支持 NVIDIA GPU（nvidia-smi）采样。' }
}

async function readNvidiaSmiUtilization(): Promise<GpuSnapshot | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,name', '--format=csv,noheader,nounits'],
      { timeout: 1500, windowsHide: true },
    )
    const line = stdout.trim().split('\n')[0]?.trim()
    if (!line) return undefined

    const [utilText, ...nameParts] = line.split(',').map((part) => part.trim())
    const percent = Number(utilText)
    if (!Number.isFinite(percent)) return undefined

    const name = nameParts.join(', ') || 'NVIDIA GPU'
    return {
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      available: true,
      detail: name,
    }
  } catch {
    return undefined
  }
}

async function readWindowsGpuCounter(): Promise<GpuSnapshot | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "(Get-Counter '\\GPU Engine(*)\\Utilization Percentage').CounterSamples | Measure-Object -Property CookedValue -Maximum | Select-Object -ExpandProperty Maximum",
      ],
      { timeout: 3500, windowsHide: true },
    )
    const percent = parseWindowsGpuCounterOutput(stdout)
    if (percent === undefined) return undefined
    return {
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      available: true,
      detail: 'Windows GPU Engine 利用率峰值',
    }
  } catch {
    return undefined
  }
}

export function parseWindowsGpuCounterOutput(stdout: string): number | undefined {
  const trimmed = stdout.trim()
  if (!trimmed) return undefined
  const percent = Number(trimmed)
  return Number.isFinite(percent) ? percent : undefined
}

export function parseDataRateText(text: string | undefined): number | null {
  if (!text) return null
  const match = text.trim().match(/^~?([\d.]+)\s*(B|[KMGT]i?B)\/s$/i)
  if (!match?.[1] || !match[2]) return null

  const value = Number(match[1])
  if (!Number.isFinite(value)) return null

  const unit = match[2].toUpperCase()
  const binary = unit.includes('I')
  const base = binary ? 1024 : 1000
  const exponent = unit.startsWith('K') ? 1 : unit.startsWith('M') ? 2 : unit.startsWith('G') ? 3 : unit.startsWith('T') ? 4 : 0
  return Math.round(value * base ** exponent)
}

export function sumYtdlpDownloadBytesPerSec(fetchTasks: FetchTaskRecord[]): number {
  return fetchTasks
    .filter((task) => task.status === 'running')
    .reduce((sum, task) => {
      const speed = Number(task.state?.download_bytes_per_sec ?? 0)
      return sum + (Number.isFinite(speed) ? Math.max(0, speed) : 0)
    }, 0)
}

export function sampleProjectNetworkRates(input: {
  browserDownloads: BrowserNetworkDownloadRecord[]
  browserRequests: BrowserNetworkRequestRecord[]
  fetchTasks: FetchTaskRecord[]
  networkSample: ProjectNetworkSample
}): ProjectNetworkRates {
  const now = Date.now()
  const browserReceivedBytes = input.browserDownloads.reduce((sum, download) => sum + download.received_bytes, 0)
  const browserRequestTotals = input.browserRequests.reduce(
    (totals, request) => ({
      responseBytes: totals.responseBytes + request.response_bytes,
      requestBytes: totals.requestBytes + (request.request_bytes ?? 0),
    }),
    { responseBytes: 0, requestBytes: 0 },
  )
  const browserResponseBytes = browserRequestTotals.responseBytes
  const browserRequestBytes = browserRequestTotals.requestBytes
  const elapsedSeconds = Math.max((now - input.networkSample.at) / 1000, 0.001)

  const receivedDelta = browserReceivedBytes - input.networkSample.browserReceivedBytes
  const responseDelta = browserResponseBytes - input.networkSample.browserResponseBytes
  const requestDelta = browserRequestBytes - input.networkSample.browserRequestBytes
  const browserDownloadBps = Math.max(0, Math.round(receivedDelta / elapsedSeconds))
  const browserResponseBps = Math.max(0, Math.round(responseDelta / elapsedSeconds))
  const browserUploadBps = Math.max(0, Math.round(requestDelta / elapsedSeconds))
  const ytdlpDownloadBps = sumYtdlpDownloadBytesPerSec(input.fetchTasks)

  return {
    uploadBytesPerSec: browserUploadBps,
    downloadBytesPerSec: browserDownloadBps + browserResponseBps + ytdlpDownloadBps,
    nextSample: {
      at: now,
      browserReceivedBytes,
      browserResponseBytes,
      browserRequestBytes,
    },
  }
}

export function formatBytesPerSecond(value: number): string {
  if (value < 1024) return `${value} B/s`
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB/s`
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / 1024 / 102.4) / 10} MB/s`
  return `${Math.round(value / 1024 / 1024 / 102.4) / 10} GB/s`
}
