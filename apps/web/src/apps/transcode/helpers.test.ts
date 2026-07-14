import { describe, expect, it } from 'vitest'

import { estimateVideoBitrateKbps, formatEstimatedSize } from '@/apps/transcode/helpers'
import type { TranscodeSourceInfo } from '@/api/types'

function source(overrides: Partial<TranscodeSourceInfo> = {}): TranscodeSourceInfo {
  return {
    isAlreadyHevc: false,
    suggestRemux: false,
    recommendedPreset: 'mp4-h264-aac',
    recommendedCrf: 20,
    recommendedEncodePreset: 'slow',
    recommendedAudioBitrate: 128,
    notes: [],
    ...overrides,
  }
}

describe('estimateVideoBitrateKbps', () => {
  it('picks the 4K table for 4K-scale resolutions', () => {
    expect(estimateVideoBitrateKbps(3840, 2160, 20)).toBe(24000)
  })

  it('picks the 1080p table for 1080p-scale resolutions', () => {
    expect(estimateVideoBitrateKbps(1920, 1080, 20)).toBe(6000)
  })

  it('picks the SD table for resolutions below 1080p', () => {
    expect(estimateVideoBitrateKbps(1280, 720, 20)).toBe(2000)
  })

  it('defaults to 1080p when width/height are missing', () => {
    expect(estimateVideoBitrateKbps(undefined, undefined, 20)).toBe(6000)
  })

  it('snaps an unlisted CRF to the closest table entry', () => {
    // CRF 21 是 20 和 22 之间，19 更靠近 20（差 1）而不是 22（差 1）——平局按遍历顺序取先出现的键。
    expect(estimateVideoBitrateKbps(1920, 1080, 21)).toBe(6000)
  })
})

describe('formatEstimatedSize', () => {
  it('uses an explicit target bitrate over the estimated one when provided', () => {
    const result = formatEstimatedSize(source({ durationSeconds: 60 }), 20, 8000, 128)
    // (8000 + 128) kbps * 60s / 8 / 1024 ≈ 59.53 MB
    expect(result).toBe('约 59.5 MB')
  })

  it('falls back to the CRF-based estimate when no target bitrate is given', () => {
    const result = formatEstimatedSize(source({ width: 1920, height: 1080, durationSeconds: 60 }), 20, undefined, 128)
    // (6000 + 128) kbps * 60s / 8 / 1024 ≈ 44.9 MB
    expect(result).toBe('约 44.9 MB')
  })

  it('reports missing duration as zero size rather than throwing', () => {
    expect(formatEstimatedSize(source(), 20, 1000, 128)).toBe('约 0.0 MB')
  })

  it('switches to GB formatting above 1024 MB', () => {
    const result = formatEstimatedSize(source({ durationSeconds: 36000 }), 20, 40000, 128)
    // (40000 + 128) kbps * 36000s / 8 / 1024 ≈ 176609 MB ≈ 172.47 GB
    expect(result).toMatch(/^约 \d+\.\d{2} GB$/)
  })
})
