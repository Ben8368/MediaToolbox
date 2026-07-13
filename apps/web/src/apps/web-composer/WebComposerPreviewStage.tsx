import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { WebComposerExportSettings, WebComposerPresetId, WebComposerPresetState } from '@mediatoolbox/contracts'

import { previewRuntimeUrl } from './model'
import { WEB_COMPOSER_CHANNEL, type WebComposerPreviewUpdateMessage } from './previewMessages'

export function WebComposerPreviewStage({ iframeRef, presetId, state, settings, ready }: {
  iframeRef: RefObject<HTMLIFrameElement>
  presetId: WebComposerPresetId
  state: WebComposerPresetState
  settings: WebComposerExportSettings
  ready: boolean
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
        <div>
          <strong>{settings.width} × {settings.height}</strong>
          <span>{settings.aspectRatio} · {settings.resolution}</span>
        </div>
        <span className="wc-template-lock">模板 v1 已锁定</span>
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
