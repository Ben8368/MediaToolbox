import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type {
  WebComposerAspectRatio,
  WebComposerExportResolution,
  WebComposerExportSettings,
  WebComposerPresetId,
  WebComposerPresetState,
} from '@mediatoolbox/contracts'

import { aspectRatioOptions, previewRuntimeUrl, resolutionOptions, resizeExportSettings } from './model'
import { WEB_COMPOSER_CHANNEL, type WebComposerPreviewUpdateMessage } from './previewMessages'

export function WebComposerPreviewStage({ iframeRef, presetId, state, settings, ready, onSettingsChange, busy, onExport, onReset }: {
  iframeRef: RefObject<HTMLIFrameElement>
  presetId: WebComposerPresetId
  state: WebComposerPresetState
  settings: WebComposerExportSettings
  ready: boolean
  onSettingsChange: (settings: WebComposerExportSettings) => void
  busy: boolean
  onExport: (kind: 'png' | 'webm') => void
  onReset: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const src = useMemo(() => previewRuntimeUrl(), [])

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

  useEffect(() => {
    if (!ready) return
    const message: WebComposerPreviewUpdateMessage = {
      channel: WEB_COMPOSER_CHANNEL,
      type: 'update',
      presetId,
      state,
      width: settings.width,
      height: settings.height,
    }
    iframeRef.current?.contentWindow?.postMessage(message, '*')
  }, [iframeRef, presetId, ready, settings.height, settings.width, state])

  const scale = viewportSize.width && viewportSize.height
    ? Math.min((viewportSize.width - 24) / settings.width, (viewportSize.height - 24) / settings.height, 1)
    : 0.25

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
        <div className="wc-preview-actions" aria-label="导出操作">
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
