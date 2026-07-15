import {
  WEB_COMPOSER_ICON_NAMES,
  getWebComposerPresetReference,
  isWebComposerAspectRatio,
  isWebComposerPresetId,
  type WebComposerEditorMode,
  type WebComposerExportSettings,
  type WebComposerPresetId,
  type WebComposerPresetState,
  type WebComposerPresetVersion,
} from '@mediatoolbox/contracts'

export const WEB_COMPOSER_CHANNEL = 'mediatoolbox:web-composer'

type WebComposerPreviewMessageBase = {
  channel: typeof WEB_COMPOSER_CHANNEL
  sessionId: string
}

export type WebComposerSlotRect = {
  x: number
  y: number
  width: number
  height: number
}

export type WebComposerPreviewUpdateMessage = WebComposerPreviewMessageBase & {
  type: 'update'
  presetId: WebComposerPresetId
  presetVersion: WebComposerPresetVersion
  state: WebComposerPresetState
  width: number
  height: number
  mode: WebComposerEditorMode
  selectedSlotId: string | null
  displayScale: number
}

export type WebComposerPreviewCaptureMessage = WebComposerPreviewMessageBase & {
  type: 'capture'
  requestId: string
  kind: 'png' | 'webm'
  settings: WebComposerExportSettings
}

export type WebComposerPreviewInboundMessage = WebComposerPreviewUpdateMessage | WebComposerPreviewCaptureMessage

export type WebComposerPreviewOutboundMessage =
  | (WebComposerPreviewMessageBase & { type: 'ready' })
  | (WebComposerPreviewMessageBase & { type: 'capture-progress'; requestId: string; current: number; total: number })
  | (WebComposerPreviewMessageBase & { type: 'capture-complete'; requestId: string; kind: 'png' | 'webm'; buffer: ArrayBuffer; mimeType: string })
  | (WebComposerPreviewMessageBase & { type: 'capture-error'; requestId: string; message: string })
  | (WebComposerPreviewMessageBase & {
    type: 'slot-selected'
    presetId: WebComposerPresetId
    presetVersion: WebComposerPresetVersion
    slotId: string | null
  })
  | (WebComposerPreviewMessageBase & {
    type: 'slot-metrics'
    presetId: WebComposerPresetId
    presetVersion: WebComposerPresetVersion
    slotId: string
    rect: WebComposerSlotRect
  })

export type WebComposerPreviewMessage = WebComposerPreviewInboundMessage | WebComposerPreviewOutboundMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && isFiniteNumber(value) && value > 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isNullableStringValue(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isFontWeight(value: unknown) {
  return value === null || (
    isFiniteNumber(value)
    && Number.isInteger(value)
    && value >= 100
    && value <= 900
    && value % 100 === 0
  )
}

function isTextContent(value: unknown) {
  if (!isRecord(value)) return false
  return typeof value.value === 'string'
    && isNullableStringValue(value.fontFamily)
    && isNullableFiniteNumber(value.fontSize)
    && isFontWeight(value.fontWeight)
    && isNullableStringValue(value.color)
}

function isIconContent(value: unknown) {
  if (!isRecord(value)) return false
  return typeof value.iconId === 'string'
    && (WEB_COMPOSER_ICON_NAMES as readonly string[]).includes(value.iconId)
    && isNullableFiniteNumber(value.size)
    && isNullableStringValue(value.color)
}

function isImageContent(value: unknown) {
  if (!isRecord(value)) return false
  return typeof value.src === 'string'
    && typeof value.alt === 'string'
    && isNullableFiniteNumber(value.width)
    && isNullableFiniteNumber(value.height)
    && (value.fit === 'contain' || value.fit === 'cover')
}

function isMediaContent(value: unknown) {
  if (!isRecord(value)) return false
  return (value.kind === 'image' || value.kind === 'video')
    && typeof value.src === 'string'
    && (value.fit === 'contain' || value.fit === 'cover')
}

function isSlotValue(value: unknown) {
  if (!isRecord(value) || !isRecord(value.offset)) return false
  if (
    typeof value.activeKind !== 'string'
    || !['text', 'icon', 'image', 'media'].includes(value.activeKind)
    || typeof value.visible !== 'boolean'
    || !isFiniteNumber(value.offset.x)
    || !isFiniteNumber(value.offset.y)
  ) return false

  if (value.text !== undefined && !isTextContent(value.text)) return false
  if (value.icon !== undefined && !isIconContent(value.icon)) return false
  if (value.image !== undefined && !isImageContent(value.image)) return false
  if (value.media !== undefined && !isMediaContent(value.media)) return false

  const activeContent = value[value.activeKind as 'text' | 'icon' | 'image' | 'media']
  return activeContent !== undefined
}

function isPresetState(value: unknown): value is WebComposerPresetState {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isWebComposerPresetId(value.id)) return false
  if (!isRecord(value.slots) || !Object.values(value.slots).every(isSlotValue)) return false
  if (!isRecord(value.theme)) return false
  return typeof value.theme.headingFont === 'string'
    && typeof value.theme.bodyFont === 'string'
    && typeof value.theme.accentColor === 'string'
    && typeof value.theme.textColor === 'string'
}

function isExportSettings(value: unknown): value is WebComposerExportSettings {
  if (!isRecord(value)) return false
  return isWebComposerAspectRatio(value.aspectRatio)
    && typeof value.resolution === 'string'
    && ['720p', '1080p', '1440p', '2160p'].includes(value.resolution)
    && isPositiveInteger(value.width)
    && isPositiveInteger(value.height)
    && isPositiveInteger(value.fps)
    && isFiniteNumber(value.durationSeconds)
    && value.durationSeconds > 0
}

function isPresetReference(record: Record<string, unknown>) {
  return getWebComposerPresetReference(record.presetId, record.presetVersion) !== null
}

function isSlotRect(value: unknown): value is WebComposerSlotRect {
  if (!isRecord(value)) return false
  return isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.width)
    && value.width >= 0
    && isFiniteNumber(value.height)
    && value.height >= 0
}

export function isWebComposerPreviewMessage(value: unknown): value is WebComposerPreviewMessage {
  if (!isRecord(value)) return false
  if (
    value.channel !== WEB_COMPOSER_CHANNEL
    || !isNonEmptyString(value.sessionId)
    || typeof value.type !== 'string'
  ) return false

  switch (value.type) {
    case 'update':
      return isPresetReference(value)
        && isPresetState(value.state)
        && value.state.id === value.presetId
        && isPositiveInteger(value.width)
        && isPositiveInteger(value.height)
        && (value.mode === 'edit' || value.mode === 'preview')
        && isNullableString(value.selectedSlotId)
        && isFiniteNumber(value.displayScale)
        && value.displayScale > 0
        && value.displayScale <= 1
    case 'capture':
      return isNonEmptyString(value.requestId)
        && (value.kind === 'png' || value.kind === 'webm')
        && isExportSettings(value.settings)
    case 'ready':
      return true
    case 'capture-progress':
      return isNonEmptyString(value.requestId)
        && isPositiveInteger(value.current)
        && isPositiveInteger(value.total)
        && value.current <= value.total
    case 'capture-complete':
      return isNonEmptyString(value.requestId)
        && (value.kind === 'png' || value.kind === 'webm')
        && value.buffer instanceof ArrayBuffer
        && isNonEmptyString(value.mimeType)
    case 'capture-error':
      return isNonEmptyString(value.requestId) && isNonEmptyString(value.message)
    case 'slot-selected':
      return isPresetReference(value) && isNullableString(value.slotId)
    case 'slot-metrics':
      return isPresetReference(value) && isNonEmptyString(value.slotId) && isSlotRect(value.rect)
    default:
      return false
  }
}

export function isWebComposerPreviewInboundMessage(value: unknown): value is WebComposerPreviewInboundMessage {
  return isWebComposerPreviewMessage(value) && (value.type === 'update' || value.type === 'capture')
}

export function isWebComposerPreviewOutboundMessage(value: unknown): value is WebComposerPreviewOutboundMessage {
  return isWebComposerPreviewMessage(value) && value.type !== 'update' && value.type !== 'capture'
}

export function getWebComposerMessageTargetOrigin(expectedOrigin: string) {
  return expectedOrigin === 'null' ? '*' : expectedOrigin
}

export function isWebComposerMessageOriginAllowed(actualOrigin: string, expectedOrigin: string) {
  return actualOrigin === expectedOrigin
}
