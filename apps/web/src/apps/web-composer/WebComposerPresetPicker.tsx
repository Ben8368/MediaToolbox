import { useEffect, useMemo, useRef, useState } from 'react'
import type { WebComposerPresetId } from '@mediatoolbox/contracts'
import { createPortal } from 'react-dom'

import { useWindowHeaderPortalTarget } from '@/windowHeaderPortal'
import { previewRuntimeUrl } from './model'
import {
  getWebComposerMessageTargetOrigin,
  isWebComposerMessageOriginAllowed,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewUpdateMessage,
} from './previewMessages'
import type { PresetDefinition } from './presets/types'
import { presets } from './presets'

function PresetThumbnail({ preset }: { preset: PresetDefinition }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionId = useMemo(
    () => `wc-thumb-${preset.id}-${Math.random().toString(36).slice(2, 10)}`,
    // intentionally stable for preset lifetime, not reactive to preset object
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset.id],
  )
  const src = useMemo(() => previewRuntimeUrl(sessionId), [sessionId])
  const expectedOrigin = useMemo(() => new URL(src).origin, [src])
  const [containerW, setContainerW] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerW(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (!isWebComposerMessageOriginAllowed(event.origin, expectedOrigin)) return
      const d = event.data
      if (
        d?.channel === WEB_COMPOSER_CHANNEL
        && d?.sessionId === sessionId
        && d?.type === 'ready'
      ) setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sessionId, expectedOrigin])

  const scale = containerW > 0 ? Math.min(containerW / preset.designSize.width, 1) : 0

  useEffect(() => {
    if (!ready || scale <= 0) return
    const message: WebComposerPreviewUpdateMessage = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'update',
      presetId: preset.id,
      presetVersion: preset.version,
      state: preset.defaults,
      width: preset.designSize.width,
      height: preset.designSize.height,
      mode: 'preview',
      selectedSlotId: null,
      displayScale: scale,
    }
    iframeRef.current?.contentWindow?.postMessage(
      message,
      getWebComposerMessageTargetOrigin(expectedOrigin),
    )
  }, [ready, scale, sessionId, expectedOrigin, preset])

  const thumbH = containerW > 0
    ? Math.round(preset.designSize.height * scale)
    : undefined

  return (
    <div
      ref={containerRef}
      className="wc-preset-thumb"
      style={thumbH !== undefined ? { height: thumbH } : undefined}
    >
      {scale > 0 && (
        <iframe
          ref={iframeRef}
          src={src}
          title={`${preset.name} 预览`}
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: preset.designSize.width,
            height: preset.designSize.height,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  )
}

export function WebComposerPresetPicker({ activePresetId, onSelect }: {
  activePresetId: WebComposerPresetId
  onSelect: (presetId: WebComposerPresetId) => void
}) {
  const portalTarget = useWindowHeaderPortalTarget()
  const [open, setOpen] = useState(false)
  const activePreset = presets.find((p) => p.id === activePresetId) ?? presets[0]

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const trigger = portalTarget ? createPortal(
    <div className="wc-preset-picker">
      <button
        type="button"
        className="wc-preset-picker__trigger"
        aria-label={`选择预设：${activePreset.name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <strong>{activePreset.name}</strong>
        <span className="wc-preset-picker__chevron" aria-hidden="true" />
      </button>
    </div>,
    portalTarget,
  ) : null

  const dialog = open ? (
    <div
      className="wc-preset-dialog-overlay"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="选择预设"
        className="wc-preset-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="wc-preset-dialog__header">
          <strong>选择预设</strong>
          <button
            type="button"
            className="wc-preset-dialog__close"
            aria-label="关闭"
            onClick={() => setOpen(false)}
          />
        </div>
        <div className="wc-preset-dialog__grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`wc-preset-card${preset.id === activePresetId ? ' is-active' : ''}`}
              onClick={() => { onSelect(preset.id); setOpen(false) }}
            >
              <div className="wc-preset-card__thumb">
                <PresetThumbnail preset={preset} />
              </div>
              <div className="wc-preset-card__info">
                <strong>{preset.name}</strong>
                <span>{preset.style}</span>
                <p>{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {trigger}
      {dialog}
    </>
  )
}
