import type { FfprobeResult } from './probe.js'
import type { TranscodePreset, VideoEncodePreset } from './args.js'

export type SourceAnalysis = {
  recommendedPreset: TranscodePreset
  recommendedCrf: number
  recommendedEncodePreset: VideoEncodePreset
  recommendedAudioBitrate: number
  sourceVideoCodec: string | undefined
  sourceAudioCodec: string | undefined
  sourceBitrateKbps: number | undefined
  isAlreadyHevc: boolean
  suggestRemux: boolean
  notes: string[]
}

export function analyzeSource(probe: FfprobeResult): SourceAnalysis {
  const videoStream = probe.streams.find((s) => s.codec_type === 'video')
  const audioStream = probe.streams.find((s) => s.codec_type === 'audio')

  const sourceVideoCodec = videoStream?.codec_name
  const sourceAudioCodec = audioStream?.codec_name

  const rawBitrate = probe.format.bit_rate
  const sourceBitrateKbps = rawBitrate ? Math.round(Number(rawBitrate) / 1000) : undefined

  const isAlreadyHevc = sourceVideoCodec === 'hevc' || sourceVideoCodec === 'h265'
  // re-encoding an already-HEVC source introduces generation loss
  const suggestRemux = isAlreadyHevc

  let recommendedPreset: TranscodePreset
  if (suggestRemux) {
    recommendedPreset = 'remux'
  } else if (!videoStream) {
    recommendedPreset = 'audio-aac'
  } else {
    recommendedPreset = 'mp4-h265-aac'
  }

  let recommendedCrf: number
  if (sourceBitrateKbps !== undefined) {
    if (sourceBitrateKbps > 20000) {
      recommendedCrf = 20
    } else if (sourceBitrateKbps > 5000) {
      recommendedCrf = 22
    } else {
      recommendedCrf = 24
    }
  } else {
    recommendedCrf = 20
  }

  const notes: string[] = []
  if (suggestRemux) {
    notes.push('源视频已是 H.265，建议使用 remux 避免二次编码损耗')
  }
  if (sourceBitrateKbps !== undefined && sourceBitrateKbps > 20000) {
    notes.push(`源码率较高（${sourceBitrateKbps} kbps），已选用较低 CRF 以保留细节`)
  }
  if (sourceAudioCodec === 'aac') {
    notes.push('源音频已是 AAC，remux 模式下将直接复制音频流')
  }

  return {
    recommendedPreset,
    recommendedCrf,
    recommendedEncodePreset: 'slow',
    recommendedAudioBitrate: 192,
    sourceVideoCodec,
    sourceAudioCodec,
    sourceBitrateKbps,
    isAlreadyHevc,
    suggestRemux,
    notes,
  }
}
