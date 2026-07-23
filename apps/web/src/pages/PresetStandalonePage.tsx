import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  WEB_COMPOSER_ASPECT_RATIO_OPTIONS,
  type WebComposerAspectRatio,
  type WebComposerPresetState,
} from '@mediatoolbox/contracts'

import { presetById, clonePresetState } from '@/apps/web-composer/presets'
import type { PresetDefinition } from '@/apps/web-composer/presets/types'
import { WebComposerPresetDialog } from '@/apps/web-composer/WebComposerPresetPicker'
import { createPreviewSessionId, previewRuntimeUrl } from '@/apps/web-composer/model'
import {
  getWebComposerMessageTargetOrigin,
  isWebComposerMessageOriginAllowed,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewUpdateMessage,
} from '@/apps/web-composer/previewMessages'

export function PresetStandaloneToolbar({ preset, aspectRatio, presetDialogOpen, onOpenPresetDialog, onChangeAspectRatio }: {
  preset: PresetDefinition
  aspectRatio: WebComposerAspectRatio
  presetDialogOpen: boolean
  onOpenPresetDialog: () => void
  onChangeAspectRatio: (aspectRatio: WebComposerAspectRatio) => void
}) {
  return (
    <div className="wc-standalone-toolbar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderBottom: '1px solid #1E293B',
      background: '#0F141E',
      flexShrink: 0,
    }}>
      <button
        type="button"
        className="wc-standalone-preset-trigger"
        aria-label={`选择预设：${preset.name}`}
        aria-expanded={presetDialogOpen}
        aria-haspopup="dialog"
        onClick={onOpenPresetDialog}
      >
        <span>预设</span>
        <strong>{preset.name}</strong>
        <span className="wc-preset-picker__chevron" aria-hidden="true" />
      </button>
      <div className="wc-standalone-aspect-options" aria-label="选择画幅">
        {WEB_COMPOSER_ASPECT_RATIO_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChangeAspectRatio(option.value)}
            style={{
              padding: '0.375rem 1rem',
              borderRadius: '0.375rem',
              border: option.value === aspectRatio ? '1px solid #38BDF8' : '1px solid #334155',
              background: option.value === aspectRatio ? '#0F2847' : 'transparent',
              color: option.value === aspectRatio ? '#38BDF8' : '#94A3B8',
              fontSize: '0.875rem',
              fontWeight: option.value === aspectRatio ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PresetStandalonePage() {
  const { presetId } = useParams<{ presetId: string }>()
  const navigate = useNavigate()
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sessionId = useMemo(createPreviewSessionId, [])
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<WebComposerPresetState | null>(null)
  const [aspectRatio, setAspectRatio] = useState<WebComposerAspectRatio>('16:9')
  const [availableW, setAvailableW] = useState(800)
  const [availableH, setAvailableH] = useState(450)
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)

  const preset = useMemo(() => {
    if (!presetId) return null
    return presetById.get(presetId as never) ?? null
  }, [presetId])

  useEffect(() => {
    if (preset) {
      setState(clonePresetState(preset.defaults))
    }
  }, [preset])

  // Track the exact available space in the preview area
  useEffect(() => {
    const el = previewAreaRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setAvailableW(entry.contentRect.width)
      setAvailableH(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const selectedAspectRatio = WEB_COMPOSER_ASPECT_RATIO_OPTIONS.find((option) => option.value === aspectRatio)
    ?? WEB_COMPOSER_ASPECT_RATIO_OPTIONS[0]
  const aspectRatioValue = selectedAspectRatio.width / selectedAspectRatio.height

  // Largest rect of the selected aspect ratio that fits in available space
  const { displayW, displayH } = useMemo(() => {
    const candidateH = Math.round(availableW / aspectRatioValue)
    if (candidateH <= availableH) return { displayW: availableW, displayH: candidateH }
    return { displayW: Math.round(availableH * aspectRatioValue), displayH: availableH }
  }, [availableW, availableH, aspectRatioValue])

  const viewportW = preset?.designSize.width ?? 1920
  const viewportH = Math.round(viewportW / aspectRatioValue)
  const scale = displayW > 0 ? displayW / viewportW : 0

  const src = useMemo(() => previewRuntimeUrl(sessionId), [sessionId])
  const expectedOrigin = useMemo(() => new URL(src).origin, [src])

  const postUpdate = useCallback(() => {
    if (!ready || !preset || !state || scale <= 0) return
    const message: WebComposerPreviewUpdateMessage = {
      channel: WEB_COMPOSER_CHANNEL,
      sessionId,
      type: 'update',
      presetId: preset.id,
      presetVersion: preset.version,
      state,
      width: viewportW,
      height: viewportH,
      mode: 'preview',
      selectedSlotId: null,
      displayScale: Math.min(1, Math.max(0.01, scale)),
    }
    iframeRef.current?.contentWindow?.postMessage(
      message,
      getWebComposerMessageTargetOrigin(expectedOrigin),
    )
  }, [ready, preset, state, sessionId, expectedOrigin, viewportW, viewportH, scale])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (!isWebComposerMessageOriginAllowed(event.origin, expectedOrigin)) return
      const d = event.data
      if (
        d?.channel === WEB_COMPOSER_CHANNEL
        && d?.sessionId === sessionId
        && d?.type === 'ready'
      ) {
        setReady(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sessionId, expectedOrigin])

  useEffect(() => {
    postUpdate()
  }, [postUpdate])

  if (!preset) {
    return null
  }

  return (
    <div className="wc-standalone-page" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0B0E14',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <PresetStandaloneToolbar
        preset={preset}
        aspectRatio={aspectRatio}
        presetDialogOpen={presetDialogOpen}
        onOpenPresetDialog={() => setPresetDialogOpen(true)}
        onChangeAspectRatio={setAspectRatio}
      />

      {presetDialogOpen && (
        <WebComposerPresetDialog
          activePresetId={preset.id}
          onSelect={(nextPresetId) => navigate(`/preset/${nextPresetId}`)}
          onClose={() => setPresetDialogOpen(false)}
        />
      )}

      {/* Preview area — fills remaining space, no padding, no scrollbars */}
      <div
        ref={previewAreaRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {scale > 0 && (
          <div style={{
            width: displayW,
            height: displayH,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <iframe
              ref={iframeRef}
              src={src}
              title={preset.name}
              sandbox="allow-scripts allow-same-origin"
              style={{
                display: 'block',
                width: viewportW,
                height: viewportH,
                border: 'none',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
