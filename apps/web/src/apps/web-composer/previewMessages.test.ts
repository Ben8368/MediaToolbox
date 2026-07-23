import type { WebComposerPresetState } from '@mediatoolbox/contracts'
import { describe, expect, it } from 'vitest'

import {
  getWebComposerMessageTargetOrigin,
  isWebComposerMessageOriginAllowed,
  isWebComposerPreviewInboundMessage,
  isWebComposerPreviewMessage,
  isWebComposerPreviewOutboundMessage,
  WEB_COMPOSER_CHANNEL,
} from './previewMessages'

const sessionId = 'preview-session-0123456789'

const state: WebComposerPresetState = {
  schemaVersion: 2,
  id: 'lumora',
  slots: {
    heading: {
      activeKind: 'text',
      visible: true,
      offset: { x: 0, y: 0 },
      text: {
        value: 'Clarity',
        fontFamily: null,
        fontSize: null,
        fontWeight: 400,
        color: null,
      },
    },
  },
  theme: {
    headingFont: 'serif',
    bodyFont: 'sans-serif',
    accentColor: '#ffffff',
    textColor: '#ffffff',
  },
}

const updateMessage = {
  channel: WEB_COMPOSER_CHANNEL,
  sessionId,
  type: 'update',
  presetId: 'lumora',
  presetVersion: 2,
  state,
  width: 1920,
  height: 1080,
  mode: 'edit',
  selectedSlotId: 'heading',
  displayScale: 0.25,
} as const

describe('web composer preview messages', () => {
  it('accepts fully shaped inbound update and capture messages', () => {
    expect(isWebComposerPreviewMessage(updateMessage)).toBe(true)
    expect(isWebComposerPreviewInboundMessage(updateMessage)).toBe(true)

    const capture = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'capture',
      requestId: 'capture-1',
      kind: 'webm',
      settings: {
        aspectRatio: '16:9',
        resolution: '1080p',
        width: 1920,
        height: 1080,
        fps: 12,
        durationSeconds: 4,
        transparentBackground: false,
      },
      transparentBackground: false,
    }

    expect(isWebComposerPreviewMessage(capture)).toBe(true)
    expect(isWebComposerPreviewInboundMessage(capture)).toBe(true)
    expect(isWebComposerPreviewOutboundMessage(capture)).toBe(false)
  })

  it('rejects missing sessions, unknown types, malformed dimensions, and mismatched preset state', () => {
    expect(isWebComposerPreviewMessage({ ...updateMessage, sessionId: '' })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...updateMessage, sessionId: undefined })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...updateMessage, type: 'surprise' })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...updateMessage, width: Number.NaN })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...updateMessage, displayScale: 0 })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...updateMessage, state: { ...state, id: 'viktor' } })).toBe(false)
  })

  it('rejects malformed slot content instead of trusting the channel name', () => {
    const missingActiveContent = {
      ...state,
      slots: {
        heading: {
          activeKind: 'text',
          visible: true,
          offset: { x: 0, y: 0 },
        },
      },
    }
    const invalidIcon = {
      ...state,
      slots: {
        heading: {
          activeKind: 'icon',
          visible: true,
          offset: { x: 0, y: 0 },
          icon: { iconId: 'not-in-the-library', size: 24, color: null },
        },
      },
    }

    expect(isWebComposerPreviewMessage({ ...updateMessage, state: missingActiveContent })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...updateMessage, state: invalidIcon })).toBe(false)
  })

  it('accepts selection and metrics outbound messages and validates their payloads', () => {
    const selected = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'slot-selected',
      presetId: 'lumora',
      presetVersion: 2,
      slotId: 'heading',
    }
    const metrics = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'slot-metrics',
      presetId: 'lumora',
      presetVersion: 2,
      slotId: 'heading',
      rect: { x: 100, y: 80, width: 540, height: 120 },
    }

    expect(isWebComposerPreviewOutboundMessage(selected)).toBe(true)
    expect(isWebComposerPreviewOutboundMessage(metrics)).toBe(true)
    expect(isWebComposerPreviewMessage({ ...metrics, rect: { ...metrics.rect, width: -1 } })).toBe(false)
    expect(isWebComposerPreviewMessage({ ...selected, presetVersion: 1 })).toBe(false)
  })

  it('validates transferable capture results', () => {
    const complete = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'capture-complete',
      requestId: 'capture-1',
      kind: 'png',
      buffer: new ArrayBuffer(8),
      mimeType: 'image/png',
    }

    expect(isWebComposerPreviewOutboundMessage(complete)).toBe(true)
    expect(isWebComposerPreviewMessage({ ...complete, buffer: {} })).toBe(false)
  })
})

describe('web composer message origins', () => {
  it('uses an exact HTTP target origin', () => {
    const origin = new URL('http://127.0.0.1:5173/web-composer-preview.html').origin
    expect(getWebComposerMessageTargetOrigin(origin)).toBe('http://127.0.0.1:5173')
    expect(isWebComposerMessageOriginAllowed('http://127.0.0.1:5173', origin)).toBe(true)
    expect(isWebComposerMessageOriginAllowed('http://localhost:5173', origin)).toBe(false)
  })

  it('uses wildcard only for posting to an opaque file origin and still checks received origin exactly', () => {
    const origin = new URL('file:///C:/MediaToolbox/renderer/web-composer-preview.html').origin
    expect(origin).toBe('null')
    expect(getWebComposerMessageTargetOrigin(origin)).toBe('*')
    expect(isWebComposerMessageOriginAllowed('null', origin)).toBe(true)
    expect(isWebComposerMessageOriginAllowed('https://example.com', origin)).toBe(false)
  })
})
