import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { WebComposerPresetState } from '@mediatoolbox/contracts'

import { presetById, clonePresetState } from '@/apps/web-composer/presets'
import { createPreviewSessionId, previewRuntimeUrl } from '@/apps/web-composer/model'
import {
  getWebComposerMessageTargetOrigin,
  isWebComposerMessageOriginAllowed,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewUpdateMessage,
} from '@/apps/web-composer/previewMessages'

const ASPECT_RATIOS = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '1.91:1', ratio: 1.91 },
  { label: '4:3', ratio: 4 / 3 },
]

const DISPLAY_WIDTH = 960

export function PresetStandalonePage() {
  const { presetId } = useParams<{ presetId: string }>()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sessionId = useMemo(createPreviewSessionId, [])
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<WebComposerPresetState | null>(null)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)

  const preset = useMemo(() => {
    if (!presetId) return null
    return presetById.get(presetId as never) ?? null
  }, [presetId])

  useEffect(() => {
    if (preset) {
      setState(clonePresetState(preset.defaults))
    }
  }, [preset])

  const viewportWidth = preset?.designSize.width ?? 1920
  const viewportHeight = Math.round(viewportWidth / aspectRatio)
  const scale = DISPLAY_WIDTH / viewportWidth
  const displayHeight = Math.round(DISPLAY_WIDTH / aspectRatio)

  const src = useMemo(() => previewRuntimeUrl(sessionId), [sessionId])
  const expectedOrigin = useMemo(() => new URL(src).origin, [src])

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

  useEffect(() => {
    if (!ready || !preset || !state) return
    const message: WebComposerPreviewUpdateMessage = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'update',
      presetId: preset.id,
      presetVersion: preset.version,
      state,
      width: viewportWidth,
      height: viewportHeight,
      mode: 'preview',
      selectedSlotId: null,
      displayScale: Math.min(1, Math.max(0.01, scale)),
    }
    iframeRef.current?.contentWindow?.postMessage(
      message,
      getWebComposerMessageTargetOrigin(expectedOrigin),
    )
  }, [ready, preset, state, sessionId, expectedOrigin, viewportWidth, viewportHeight, scale])

  if (!preset) {
    return null
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0B0E14',
    }}>
      {/* Aspect ratio toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #1E293B',
        background: '#0F141E',
      }}>
        {ASPECT_RATIOS.map(({ label, ratio }) => (
          <button
            key={label}
            type="button"
            onClick={() => setAspectRatio(ratio)}
            style={{
              padding: '0.375rem 1rem',
              borderRadius: '0.375rem',
              border: ratio === aspectRatio ? '1px solid #38BDF8' : '1px solid #334155',
              background: ratio === aspectRatio ? '#0F2847' : 'transparent',
              color: ratio === aspectRatio ? '#38BDF8' : '#94A3B8',
              fontSize: '0.875rem',
              fontWeight: ratio === aspectRatio ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{
          marginLeft: '1rem',
          fontSize: '0.75rem',
          color: '#64748B',
        }}>
          {viewportWidth}×{viewportHeight}
        </span>
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <div style={{
          width: DISPLAY_WIDTH,
          height: displayHeight,
          overflow: 'hidden',
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}>
          <iframe
            ref={iframeRef}
            src={src}
            title={preset.name}
            sandbox="allow-scripts allow-same-origin"
            style={{
              width: viewportWidth,
              height: viewportHeight,
              border: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
    </div>
  )
}
