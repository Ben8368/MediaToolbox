import type { OkResult } from './core.js'

export type TranscodeSourceInfo = {
  videoCodec?: string
  audioCodec?: string
  width?: number
  height?: number
  fps?: string
  bitrateKbps?: number
  durationSeconds?: number
  isAlreadyHevc: boolean
  suggestRemux: boolean
  recommendedPreset: string
  recommendedCrf: number
  recommendedEncodePreset: string
  recommendedAudioBitrate: number
  notes: string[]
}

export type TranscodeProbeResponse = OkResult & {
  source?: TranscodeSourceInfo
}

export type TranscodeCommandPreviewResponse = OkResult & {
  args?: string[]
}
