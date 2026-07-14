import type { TranscodeJobDraft, TranscodeSourceInfo } from '@/api/types'

export const TRANSCODE_PRESETS: Array<{ value: NonNullable<TranscodeJobDraft['preset']>; label: string }> = [
  { value: 'mp4-h265-aac', label: 'MP4 H.265 / AAC（推荐）' },
  { value: 'mp4-h264-aac', label: 'MP4 H.264 / AAC' },
  { value: 'mkv-h265-aac', label: 'MKV H.265 / AAC（保留字幕）' },
  { value: 'remux', label: 'Remux（仅转封装）' },
  { value: 'audio-aac', label: 'AAC 音频' },
  { value: 'audio-mp3', label: 'MP3 音频' },
  { value: 'copy', label: '流复制' },
]

export const TRANSCODE_PRESET_EXTENSIONS: Record<NonNullable<TranscodeJobDraft['preset']>, string> = {
  'mp4-h265-aac': 'mp4',
  'mp4-h264-aac': 'mp4',
  'mkv-h265-aac': 'mkv',
  remux: 'mp4',
  'audio-aac': 'm4a',
  'audio-mp3': 'mp3',
  copy: 'mp4',
}

const BITRATE_TABLE_4K: Record<number, number> = { 16: 40000, 18: 32000, 20: 24000, 22: 18000, 24: 13000, 26: 9000, 28: 6500 }
const BITRATE_TABLE_1080P: Record<number, number> = { 16: 12000, 18: 8500, 20: 6000, 22: 4500, 24: 3200, 26: 2200, 28: 1500 }
const BITRATE_TABLE_SD: Record<number, number> = { 16: 4000, 18: 2800, 20: 2000, 22: 1400, 24: 1000, 26: 700, 28: 500 }

export function estimateVideoBitrateKbps(width: number | undefined, height: number | undefined, crf: number): number {
  const pixels = (width ?? 1920) * (height ?? 1080)
  const table = pixels >= 3840 * 2160 * 0.8
    ? BITRATE_TABLE_4K
    : pixels >= 1920 * 1080 * 0.8
      ? BITRATE_TABLE_1080P
      : BITRATE_TABLE_SD
  const keys = Object.keys(table).map(Number)
  let closest = keys[0] ?? 20
  for (const k of keys) {
    if (Math.abs(k - crf) < Math.abs(closest - crf)) closest = k
  }
  return table[closest] ?? 6000
}

export function formatEstimatedSize(
  source: TranscodeSourceInfo,
  crf: number,
  targetBitrateKbpsValue: number | undefined,
  audioBitrateKbps: number,
): string {
  const videoBitrateKbps = targetBitrateKbpsValue ?? estimateVideoBitrateKbps(source.width, source.height, crf)
  const totalKbps = videoBitrateKbps + audioBitrateKbps
  const durationSeconds = source.durationSeconds ?? 0
  const sizeMb = (totalKbps * durationSeconds) / 8 / 1024
  return sizeMb >= 1024 ? `约 ${(sizeMb / 1024).toFixed(2)} GB` : `约 ${sizeMb.toFixed(1)} MB`
}
