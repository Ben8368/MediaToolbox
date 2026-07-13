export type WebComposerPresetId = 'lumora' | 'vaultshield' | 'viktor'

export type WebComposerMediaKind = 'video' | 'image'

export type WebComposerAspectRatio = '16:9' | '4:3' | '1:1' | '9:16'

export type WebComposerExportResolution = '720p' | '1080p' | '1440p' | '2160p'

export type WebComposerEditableField = {
  key: string
  label: string
  kind: 'text' | 'textarea'
  maxLength?: number
}

export type WebComposerPresetState = {
  id: WebComposerPresetId
  texts: Record<string, string>
  headingFont: string
  bodyFont: string
  accentColor: string
  textColor: string
  backgroundKind: WebComposerMediaKind
  backgroundUrl: string
}

export type WebComposerPresetManifest = {
  id: WebComposerPresetId
  version: 1
  name: string
  style: string
  description: string
  fields: WebComposerEditableField[]
  defaults: WebComposerPresetState
  upstreamSourceSha: string
  upstreamStyleSha: string
}

export type WebComposerExportSettings = {
  aspectRatio: WebComposerAspectRatio
  resolution: WebComposerExportResolution
  width: number
  height: number
  fps: number
  durationSeconds: number
}

export type WebComposerComposition = {
  id: string
  presetId: WebComposerPresetId
  presetVersion: 1
  state: WebComposerPresetState
  exportSettings: WebComposerExportSettings
  updatedAt: number
}

export type WebComposerCaptureMetadata = {
  presetId: WebComposerPresetId
  presetVersion: 1
  width: number
  height: number
  fps?: number
  durationSeconds?: number
}
