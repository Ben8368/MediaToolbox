import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  WebComposerEditorMode,
  WebComposerPresetId,
  WebComposerPresetState,
  WebComposerPresetVersion,
  WebComposerSlotManifest,
} from '@mediatoolbox/contracts'

import { clonePresetState, presetById, presets } from './presets'
import { capturePreview, type WebComposerPostToParent } from './previewCapture'
import {
  getWebComposerMessageTargetOrigin,
  isWebComposerMessageOriginAllowed,
  isWebComposerPreviewInboundMessage,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewOutboundMessage,
  type WebComposerSlotRect,
} from './previewMessages'
import {
  WebComposerSelectionOverlay,
  type WebComposerSelectionTarget,
} from './WebComposerSelectionOverlay'

type PreviewSnapshot = {
  presetId: WebComposerPresetId
  presetVersion: WebComposerPresetVersion
  state: WebComposerPresetState
  width: number
  height: number
  mode: WebComposerEditorMode
  selectedSlotId: string | null
  displayScale: number
}

const initialPreset = presets[0]

function findDelegatedSlotElement(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof Element)) return null
  const slotElement = target.closest<HTMLElement>('[data-wc-slot]')
  return slotElement && root.contains(slotElement) ? slotElement : null
}

function findRenderedSlotElement(root: HTMLElement, slotId: string) {
  const matches = [...root.querySelectorAll<HTMLElement>('[data-wc-slot]')]
    .filter((element) => element.dataset.wcSlot === slotId)
  return matches.find((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }) ?? matches[0] ?? null
}

function createSelectionTarget(
  element: HTMLElement | null,
  slots: readonly WebComposerSlotManifest[],
): WebComposerSelectionTarget | null {
  const slotId = element?.dataset.wcSlot?.trim()
  if (!element || !slotId) return null
  const slot = slots.find((candidate) => candidate.id === slotId)
  return slot ? { element, slotId, label: slot.label } : null
}

function sameSelectionTarget(
  left: WebComposerSelectionTarget | null,
  right: WebComposerSelectionTarget | null,
) {
  return left?.element === right?.element && left?.slotId === right?.slotId && left?.label === right?.label
}

function blockPresetInteraction(event: Event) {
  event.preventDefault()
  event.stopPropagation()
}

export function WebComposerPreviewRuntime() {
  const rootRef = useRef<HTMLDivElement>(null)
  const captureInFlightRef = useRef(false)
  const sessionId = useMemo(() => new URLSearchParams(window.location.search).get('session')?.trim() ?? '', [])
  const parentOrigin = window.location.origin
  const targetOrigin = getWebComposerMessageTargetOrigin(parentOrigin)
  const [capturing, setCapturing] = useState(false)
  const [hoveredTarget, setHoveredTarget] = useState<WebComposerSelectionTarget | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<WebComposerSelectionTarget | null>(null)
  const [snapshot, setSnapshot] = useState<PreviewSnapshot>({
    presetId: initialPreset.id,
    presetVersion: initialPreset.version,
    state: clonePresetState(initialPreset.defaults),
    width: 1920,
    height: 1080,
    mode: 'preview',
    selectedSlotId: null,
    displayScale: 0.25,
  })

  const postToParent = useCallback<WebComposerPostToParent>((message, transfer = []) => {
    if (!sessionId) return
    const outbound = { ...message, sessionId } as WebComposerPreviewOutboundMessage
    window.parent.postMessage(outbound, targetOrigin, transfer)
  }, [sessionId, targetOrigin])

  useEffect(() => {
    if (!sessionId) return
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== window.parent
        || !isWebComposerMessageOriginAllowed(event.origin, parentOrigin)
        || !isWebComposerPreviewInboundMessage(event.data)
        || event.data.sessionId !== sessionId
      ) return

      if (event.data.type === 'update') {
        const message = event.data
        const nextPreset = presetById.get(message.presetId)
        if (
          !nextPreset
          || nextPreset.version !== message.presetVersion
          || message.state.id !== message.presetId
        ) return
        const selectedSlotId = message.selectedSlotId === null
          || nextPreset.slots.some((slot) => slot.id === message.selectedSlotId)
          ? message.selectedSlotId
          : null
        setSnapshot({
          presetId: message.presetId,
          presetVersion: message.presetVersion,
          state: clonePresetState(message.state),
          width: message.width,
          height: message.height,
          mode: message.mode,
          selectedSlotId,
          displayScale: message.displayScale,
        })
        return
      }

      const request = event.data
      const root = rootRef.current
      if (!root) return
      if (captureInFlightRef.current) {
        postToParent({
          channel: WEB_COMPOSER_CHANNEL,
          type: 'capture-error',
          requestId: request.requestId,
          message: '已有捕获任务正在执行。',
        })
        return
      }

      captureInFlightRef.current = true
      setCapturing(true)
      setHoveredTarget(null)
      const capture = capturePreview(root, request, postToParent)
      void capture.catch((error) => {
        postToParent({
          channel: WEB_COMPOSER_CHANNEL,
          type: 'capture-error',
          requestId: request.requestId,
          message: error instanceof Error ? error.message : String(error),
        })
      }).finally(() => {
        captureInFlightRef.current = false
        setCapturing(false)
      })
    }

    window.addEventListener('message', onMessage)
    postToParent({ channel: WEB_COMPOSER_CHANNEL, type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [parentOrigin, postToParent, sessionId])

  const preset = presetById.get(snapshot.presetId) ?? initialPreset
  const PresetComponent = preset.Component

  useEffect(() => {
    if (snapshot.mode !== 'edit') {
      setHoveredTarget(null)
      return
    }
    const root = rootRef.current
    if (!root || !snapshot.selectedSlotId) {
      setSelectedTarget(null)
      return
    }
    const next = createSelectionTarget(
      findRenderedSlotElement(root, snapshot.selectedSlotId),
      preset.slots,
    )
    setSelectedTarget((current) => sameSelectionTarget(current, next) ? current : next)
  }, [preset.slots, snapshot.mode, snapshot.presetId, snapshot.selectedSlotId, snapshot.state])

  const selectSlotFromTarget = useCallback((target: EventTarget | null) => {
    const root = rootRef.current
    const next = root
      ? createSelectionTarget(findDelegatedSlotElement(target, root), preset.slots)
      : null
    setSelectedTarget(next)
    postToParent({
      channel: WEB_COMPOSER_CHANNEL,
      type: 'slot-selected',
      presetId: preset.id,
      presetVersion: preset.version,
      slotId: next?.slotId ?? null,
    })
  }, [postToParent, preset.id, preset.slots, preset.version])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onPointerMove = (event: PointerEvent) => {
      if (snapshot.mode !== 'edit' || capturing) {
        setHoveredTarget(null)
        return
      }
      const next = createSelectionTarget(findDelegatedSlotElement(event.target, root), preset.slots)
      setHoveredTarget((current) => sameSelectionTarget(current, next) ? current : next)
    }
    const onPointerLeave = () => setHoveredTarget(null)
    const onPointerDown = (event: PointerEvent) => {
      if (snapshot.mode !== 'edit' && !capturing) return
      // Canceling pointerdown would suppress Chromium's later click, which owns slot selection.
      event.stopPropagation()
    }
    const onClick = (event: MouseEvent) => {
      if (snapshot.mode !== 'edit' && !capturing) return
      if (!capturing) selectSlotFromTarget(event.target)
      blockPresetInteraction(event)
    }
    const onBlock = (event: Event) => {
      if (snapshot.mode === 'edit' || capturing) blockPresetInteraction(event)
    }

    root.addEventListener('pointermove', onPointerMove, true)
    root.addEventListener('pointerleave', onPointerLeave)
    root.addEventListener('pointerdown', onPointerDown, true)
    root.addEventListener('mousedown', onBlock, true)
    root.addEventListener('click', onClick, true)
    root.addEventListener('dragstart', onBlock, true)
    root.addEventListener('submit', onBlock, true)
    return () => {
      root.removeEventListener('pointermove', onPointerMove, true)
      root.removeEventListener('pointerleave', onPointerLeave)
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeEventListener('mousedown', onBlock, true)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('dragstart', onBlock, true)
      root.removeEventListener('submit', onBlock, true)
    }
  }, [capturing, preset.slots, selectSlotFromTarget, snapshot.mode])

  const handleSelectedMetrics = useCallback((slotId: string, rect: WebComposerSlotRect) => {
    const scaleX = preset.designSize.width / snapshot.width
    const scaleY = preset.designSize.height / snapshot.height
    postToParent({
      channel: WEB_COMPOSER_CHANNEL,
      type: 'slot-metrics',
      presetId: snapshot.presetId,
      presetVersion: snapshot.presetVersion,
      slotId,
      rect: {
        x: rect.x * scaleX,
        y: rect.y * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
      },
    })
  }, [
    postToParent,
    preset.designSize.height,
    preset.designSize.width,
    snapshot.height,
    snapshot.presetId,
    snapshot.presetVersion,
    snapshot.width,
  ])

  const overlayEnabled = snapshot.mode === 'edit' && !capturing

  return (
    <div
      className={`wc-preview-runtime ${overlayEnabled ? 'wc-preview-runtime--editing' : ''}`}
      style={{ width: snapshot.width, height: snapshot.height }}
    >
      <div
        ref={rootRef}
        className="wc-preview-capture-root"
        style={{ width: snapshot.width, height: snapshot.height }}
        data-web-composer-preset={`${preset.id}@${preset.version}`}
      >
        <PresetComponent
          state={snapshot.state}
          viewport={{
            width: snapshot.width,
            height: snapshot.height,
            designWidth: preset.designSize.width,
            designHeight: preset.designSize.height,
          }}
        />
      </div>
      <WebComposerSelectionOverlay
        rootRef={rootRef}
        hovered={hoveredTarget}
        selected={selectedTarget}
        enabled={overlayEnabled}
        displayScale={snapshot.displayScale}
        onSelectedMetrics={handleSelectedMetrics}
      />
    </div>
  )
}
