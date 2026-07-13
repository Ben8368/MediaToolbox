import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type {
  WebComposerAspectRatio,
  WebComposerEditorMode,
  WebComposerExportResolution,
  WebComposerExportSettings,
  WebComposerPresetState,
} from '@mediatoolbox/contracts'

import { aspectRatioOptions, previewRuntimeUrl, resolutionOptions, resizeExportSettings } from './model'
import type { PresetDefinition } from './presets/types'
import {
  getWebComposerMessageTargetOrigin,
  isWebComposerMessageOriginAllowed,
  isWebComposerPreviewOutboundMessage,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewUpdateMessage,
  type WebComposerSlotRect,
} from './previewMessages'

export function WebComposerPreviewStage({
  iframeRef,
  sessionId,
  preset,
  state,
  settings,
  ready,
  mode,
  selectedSlotId,
  onModeChange,
  onSlotSelect,
  onSlotMetrics,
  onSettingsChange,
  busy,
  onExport,
  onReset,
}: {
  iframeRef: RefObject<HTMLIFrameElement>
  sessionId: string
  preset: PresetDefinition
  state: WebComposerPresetState
  settings: WebComposerExportSettings
  ready: boolean
  mode: WebComposerEditorMode
  selectedSlotId: string | null
  onModeChange: (mode: WebComposerEditorMode) => void
  onSlotSelect: (slotId: string | null) => void
  onSlotMetrics: (slotId: string, rect: WebComposerSlotRect) => void
  onSettingsChange: (settings: WebComposerExportSettings) => void
  busy: boolean
  onExport: (kind: 'png' | 'webm') => void
  onReset: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const src = useMemo(() => previewRuntimeUrl(sessionId), [sessionId])
  const expectedOrigin = useMemo(() => new URL(src).origin, [src])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const scale = viewportSize.width && viewportSize.height
    ? Math.min((viewportSize.width - 24) / settings.width, (viewportSize.height - 24) / settings.height, 1)
    : 0.25

  useEffect(() => {
    if (!ready) return
    const message: WebComposerPreviewUpdateMessage = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'update',
      presetId: preset.id,
      presetVersion: preset.version,
      state,
      width: settings.width,
      height: settings.height,
      mode,
      selectedSlotId,
      displayScale: Math.max(0.01, scale),
    }
    iframeRef.current?.contentWindow?.postMessage(message, getWebComposerMessageTargetOrigin(expectedOrigin))
  }, [expectedOrigin, iframeRef, mode, preset.id, preset.version, ready, scale, selectedSlotId, sessionId, settings.height, settings.width, state])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== iframeRef.current?.contentWindow
        || !isWebComposerMessageOriginAllowed(event.origin, expectedOrigin)
        || !isWebComposerPreviewOutboundMessage(event.data)
        || event.data.sessionId !== sessionId
      ) return
      if (
        event.data.type === 'slot-selected'
        && event.data.presetId === preset.id
        && event.data.presetVersion === preset.version
      ) {
        const slotId = event.data.slotId
        onSlotSelect(slotId && preset.slots.some((slot) => slot.id === slotId) ? slotId : null)
      } else if (
        event.data.type === 'slot-metrics'
        && event.data.presetId === preset.id
        && event.data.presetVersion === preset.version
        && preset.slots.some((slot) => slot.id === event.data.slotId)
      ) {
        onSlotMetrics(event.data.slotId, event.data.rect)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [expectedOrigin, iframeRef, onSlotMetrics, onSlotSelect, preset.id, preset.slots, preset.version, sessionId])

  return (
    <main className="wc-preview-panel">
      <div className="wc-preview-toolbar">
        <div className="wc-export-settings" aria-label="导出设置">
          <label>
            <span>比例</span>
            <select
              value={settings.aspectRatio}
              onChange={(event) => onSettingsChange(resizeExportSettings(settings, { aspectRatio: event.target.value as WebComposerAspectRatio }))}
            >
              {aspectRatioOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>分辨率</span>
            <select
              value={settings.resolution}
              onChange={(event) => onSettingsChange(resizeExportSettings(settings, { resolution: event.target.value as WebComposerExportResolution }))}
            >
              {resolutionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>帧率</span>
            <input type="number" min={1} max={30} value={settings.fps} onChange={(event) => onSettingsChange({ ...settings, fps: Math.min(30, Math.max(1, Number(event.target.value) || 1)) })} />
          </label>
          <label>
            <span>时长</span>
            <input type="number" min={1} max={15} value={settings.durationSeconds} onChange={(event) => onSettingsChange({ ...settings, durationSeconds: Math.min(15, Math.max(1, Number(event.target.value) || 1)) })} />
          </label>
          <span className="wc-export-dimensions">{settings.width} × {settings.height}</span>
        </div>
        <div className="wc-preview-actions" aria-label="预览与导出操作">
          <div className="wc-mode-toggle" aria-label="画布模式">
            <button type="button" className={mode === 'edit' ? 'is-active' : ''} aria-pressed={mode === 'edit'} onClick={() => onModeChange('edit')}>编辑</button>
            <button type="button" className={mode === 'preview' ? 'is-active' : ''} aria-pressed={mode === 'preview'} onClick={() => onModeChange('preview')}>预览</button>
          </div>
          <button type="button" disabled={busy} onClick={() => onExport('png')}>导出 PNG</button>
          <button type="button" disabled={busy} onClick={() => onExport('webm')}>导出 MP4</button>
          <button type="button" className="wc-preview-actions__reset" disabled={busy} onClick={onReset}>恢复默认</button>
        </div>
      </div>
      <div className="wc-preview-viewport" ref={viewportRef}>
        <div className="wc-preview-box" style={{ width: settings.width * scale, height: settings.height * scale }}>
          <iframe
            ref={iframeRef}
            className="wc-preview-frame"
            src={src}
            title="网页合成预设画布"
            sandbox="allow-scripts allow-same-origin"
            style={{
              width: settings.width,
              height: settings.height,
              transform: `scale(${scale})`,
            }}
          />
          {!ready && <div className="wc-preview-loading">正在载入预设画布…</div>}
        </div>
      </div>
    </main>
  )
}
