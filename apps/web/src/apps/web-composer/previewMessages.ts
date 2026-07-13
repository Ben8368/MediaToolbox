import type { WebComposerExportSettings, WebComposerPresetId, WebComposerPresetState } from '@mediatoolbox/contracts'

export const WEB_COMPOSER_CHANNEL = 'mediatoolbox:web-composer'

export type WebComposerPreviewUpdateMessage = {
  channel: typeof WEB_COMPOSER_CHANNEL
  type: 'update'
  presetId: WebComposerPresetId
  state: WebComposerPresetState
  width: number
  height: number
}

export type WebComposerPreviewCaptureMessage = {
  channel: typeof WEB_COMPOSER_CHANNEL
  type: 'capture'
  requestId: string
  kind: 'png' | 'webm'
  settings: WebComposerExportSettings
}

export type WebComposerPreviewInboundMessage = WebComposerPreviewUpdateMessage | WebComposerPreviewCaptureMessage

export type WebComposerPreviewOutboundMessage =
  | { channel: typeof WEB_COMPOSER_CHANNEL; type: 'ready' }
  | { channel: typeof WEB_COMPOSER_CHANNEL; type: 'capture-progress'; requestId: string; current: number; total: number }
  | { channel: typeof WEB_COMPOSER_CHANNEL; type: 'capture-complete'; requestId: string; kind: 'png' | 'webm'; buffer: ArrayBuffer; mimeType: string }
  | { channel: typeof WEB_COMPOSER_CHANNEL; type: 'capture-error'; requestId: string; message: string }

export type WebComposerPreviewMessage = WebComposerPreviewInboundMessage | WebComposerPreviewOutboundMessage

export function isWebComposerPreviewMessage(value: unknown): value is WebComposerPreviewMessage {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.channel === WEB_COMPOSER_CHANNEL && typeof record.type === 'string'
}
