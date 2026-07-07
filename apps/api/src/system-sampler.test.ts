import { describe, expect, it } from 'vitest'
import { formatBytesPerSecond } from '@mediatoolbox/shared'

import {
  parseDataRateText,
  parseWindowsGpuCounterOutput,
  resetCpuSamplerForTests,
  sampleCpuPercent,
  sampleProjectNetworkRates,
  sumYtdlpDownloadBytesPerSec,
} from './system-sampler.js'

describe('system sampler', () => {
  it('parses yt-dlp style transfer rates', () => {
    expect(parseDataRateText('4.20MiB/s')).toBe(Math.round(4.2 * 1024 * 1024))
    expect(parseDataRateText('~4.20MiB/s')).toBe(Math.round(4.2 * 1024 * 1024))
    expect(parseDataRateText('512KiB/s')).toBe(512 * 1024)
    expect(parseDataRateText('10 B/s')).toBe(10)
    expect(parseDataRateText('1.5MB/s')).toBe(Math.round(1.5 * 1000 * 1000))
    expect(parseDataRateText('10 IB/s')).toBeNull()
    expect(parseDataRateText('')).toBeNull()
  })

  it('rejects empty Windows GPU counter output', () => {
    expect(parseWindowsGpuCounterOutput('')).toBeUndefined()
    expect(parseWindowsGpuCounterOutput('  \r\n')).toBeUndefined()
    expect(parseWindowsGpuCounterOutput('12.4')).toBe(12.4)
  })

  it('samples CPU usage from consecutive deltas', () => {
    resetCpuSamplerForTests()
    expect(sampleCpuPercent()).toBe(0)
    expect(sampleCpuPercent()).toBeGreaterThanOrEqual(0)
    expect(sampleCpuPercent()).toBeLessThanOrEqual(100)
  })

  it('aggregates project network rates from browser and yt-dlp activity', () => {
    const now = Date.now()
    const rates = sampleProjectNetworkRates({
      browserDownloads: [{ received_bytes: 2048 } as never],
      browserRequests: [{ response_bytes: 1024, request_bytes: 512 } as never],
      fetchTasks: [{ status: 'running', state: { download_bytes_per_sec: 4096 } } as never],
      networkSample: {
        at: now - 1000,
        browserReceivedBytes: 1024,
        browserResponseBytes: 0,
        browserRequestBytes: 0,
      },
    })

    expect(rates.uploadBytesPerSec).toBe(512)
    expect(rates.downloadBytesPerSec).toBe(1024 + 1024 + 4096)
    expect(formatBytesPerSecond(rates.downloadBytesPerSec)).toContain('/s')
    expect(formatBytesPerSecond(2 * 1024 * 1024 * 1024)).toBe('2 GB/s')
  })

  it('sums active yt-dlp download speeds only', () => {
    const total = sumYtdlpDownloadBytesPerSec([
      { status: 'running', state: { download_bytes_per_sec: 1000 } } as never,
      { status: 'completed', state: { download_bytes_per_sec: 5000 } } as never,
      { status: 'running', state: { download_bytes_per_sec: 2000 } } as never,
    ])
    expect(total).toBe(3000)
  })
})
