export const WEB_COMPOSER_PRESET_CATALOG = {
  'multi-showcase': { currentVersion: 2, supportedVersions: [2] },
  lumora: { currentVersion: 2, supportedVersions: [2] },
  vaultshield: { currentVersion: 2, supportedVersions: [2] },
  viktor: { currentVersion: 2, supportedVersions: [2] },
} as const

export type WebComposerPresetId = keyof typeof WEB_COMPOSER_PRESET_CATALOG

export type WebComposerPresetVersion =
  (typeof WEB_COMPOSER_PRESET_CATALOG)[WebComposerPresetId]['supportedVersions'][number]

export type WebComposerPresetReference = {
  [PresetId in WebComposerPresetId]: {
    presetId: PresetId
    presetVersion: (typeof WEB_COMPOSER_PRESET_CATALOG)[PresetId]['supportedVersions'][number]
  }
}[WebComposerPresetId]

export function isWebComposerPresetId(value: unknown): value is WebComposerPresetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WEB_COMPOSER_PRESET_CATALOG, value)
}

export function getWebComposerPresetReference(
  presetId: unknown,
  presetVersion: unknown,
): WebComposerPresetReference | null {
  if (!isWebComposerPresetId(presetId) || typeof presetVersion !== 'number') return null
  const supportedVersions = WEB_COMPOSER_PRESET_CATALOG[presetId].supportedVersions as readonly number[]
  if (!supportedVersions.includes(presetVersion)) return null
  return { presetId, presetVersion } as WebComposerPresetReference
}

export type WebComposerMediaKind = 'video' | 'image'

export const WEB_COMPOSER_ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '1.91:1', label: '1.91:1', width: 191, height: 100 },
  { value: '1:1.91', label: '1:1.91', width: 100, height: 191 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '3:4', label: '3:4', width: 3, height: 4 },
  { value: '1:1', label: '1:1', width: 1, height: 1 },
] as const

export type WebComposerAspectRatio = (typeof WEB_COMPOSER_ASPECT_RATIO_OPTIONS)[number]['value']

export function isWebComposerAspectRatio(value: unknown): value is WebComposerAspectRatio {
  return typeof value === 'string'
    && WEB_COMPOSER_ASPECT_RATIO_OPTIONS.some((option) => option.value === value)
}

export type WebComposerExportResolution = '720p' | '1080p' | '1440p' | '2160p'

export type WebComposerEditorMode = 'edit' | 'preview'

export const WEB_COMPOSER_ICON_NAMES = [
  'arrow-right',
  'arrow-right-circle',
  'badge-check',
  'circle-check',
  'fingerprint',
  'heart',
  'image',
  'lock-keyhole',
  'menu',
  'shield',
  'sparkles',
  'star',
  'vault-logo',
  'zap',
] as const

export type WebComposerIconName = (typeof WEB_COMPOSER_ICON_NAMES)[number]

export type WebComposerFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

export type WebComposerNumberControl = {
  min: number
  max: number
  step: number
}

export type WebComposerTextEditor = {
  multiline?: boolean
  maxLength?: number
  fontFamily?: boolean
  fontSize?: WebComposerNumberControl
  fontWeight?: readonly WebComposerFontWeight[]
  color?: boolean
}

export type WebComposerIconEditor = {
  iconIds: readonly WebComposerIconName[]
  size?: WebComposerNumberControl
  color?: boolean
}

export type WebComposerImageEditor = {
  accept: 'image/*'
  width?: WebComposerNumberControl
  height?: WebComposerNumberControl
  fit?: readonly ('contain' | 'cover')[]
}

export type WebComposerMediaEditor = {
  accept: 'image/*,video/*'
  kinds: readonly WebComposerMediaKind[]
  fit?: readonly ('contain' | 'cover')[]
}

export type WebComposerSlotContentKind = 'text' | 'icon' | 'image' | 'media'

export type WebComposerSlotManifest = {
  id: string
  label: string
  group: string
  canHide: boolean
  fontRole?: 'heading' | 'body'
  offset?: {
    x: WebComposerNumberControl
    y: WebComposerNumberControl
  }
  editors: {
    text?: WebComposerTextEditor
    icon?: WebComposerIconEditor
    image?: WebComposerImageEditor
    media?: WebComposerMediaEditor
  }
}

export type WebComposerTextContent = {
  value: string
  fontFamily: string | null
  fontSize: number | null
  fontWeight: WebComposerFontWeight | null
  color: string | null
}

export type WebComposerIconContent = {
  iconId: WebComposerIconName
  size: number | null
  color: string | null
}

export type WebComposerImageContent = {
  src: string
  alt: string
  width: number | null
  height: number | null
  fit: 'contain' | 'cover'
}

export type WebComposerMediaContent = {
  kind: WebComposerMediaKind
  src: string
  fit: 'contain' | 'cover'
}

export type WebComposerSlotValue = {
  activeKind: WebComposerSlotContentKind
  visible: boolean
  offset: { x: number; y: number }
  text?: WebComposerTextContent
  icon?: WebComposerIconContent
  image?: WebComposerImageContent
  media?: WebComposerMediaContent
}

export type WebComposerPresetState = {
  schemaVersion: 2
  id: WebComposerPresetId
  slots: Record<string, WebComposerSlotValue>
  theme: {
    headingFont: string
    bodyFont: string
    accentColor: string
    textColor: string
  }
}

export type WebComposerPresetManifest = {
  id: WebComposerPresetId
  version: WebComposerPresetVersion
  name: string
  style: string
  description: string
  designSize: { width: number; height: number }
  slots: readonly WebComposerSlotManifest[]
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
  presetVersion: WebComposerPresetVersion
  state: WebComposerPresetState
  exportSettings: WebComposerExportSettings
  updatedAt: number
}

export type WebComposerCaptureMetadata = {
  presetId: WebComposerPresetId
  presetVersion: WebComposerPresetVersion
  width: number
  height: number
  fps?: number
  durationSeconds?: number
}
