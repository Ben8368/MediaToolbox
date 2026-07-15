import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

import type { WebComposerSlotRect } from './previewMessages'

export type WebComposerSelectionTarget = {
  element: HTMLElement
  slotId: string
  label: string
}

type MeasuredTarget = WebComposerSelectionTarget & WebComposerSlotRect

type OverlayFrame = {
  hovered: MeasuredTarget | null
  selected: MeasuredTarget | null
}

const emptyFrame: OverlayFrame = { hovered: null, selected: null }
export const selectionIndicatorDurationMs = 1200

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.25
}

function sameMeasuredTarget(left: MeasuredTarget | null, right: MeasuredTarget | null) {
  if (left === right) return true
  if (!left || !right) return false
  return left.element === right.element
    && left.slotId === right.slotId
    && left.label === right.label
    && sameNumber(left.x, right.x)
    && sameNumber(left.y, right.y)
    && sameNumber(left.width, right.width)
    && sameNumber(left.height, right.height)
}

function sameFrame(left: OverlayFrame, right: OverlayFrame) {
  return sameMeasuredTarget(left.hovered, right.hovered)
    && sameMeasuredTarget(left.selected, right.selected)
}

function measureTarget(root: HTMLElement, target: WebComposerSelectionTarget | null): MeasuredTarget | null {
  if (!target || !target.element.isConnected || !root.contains(target.element)) return null
  const rootRect = root.getBoundingClientRect()
  const targetRect = target.element.getBoundingClientRect()
  if (targetRect.width <= 0 || targetRect.height <= 0) return null
  return {
    ...target,
    x: targetRect.left - rootRect.left,
    y: targetRect.top - rootRect.top,
    width: targetRect.width,
    height: targetRect.height,
  }
}

function Outline({ target, kind, inverseScale }: {
  target: MeasuredTarget
  kind: 'hovered' | 'selected'
  inverseScale: number
}) {
  const strokeWidth = 1.5 * inverseScale
  const style = {
    left: target.x,
    top: target.y,
    width: target.width,
    height: target.height,
    '--wc-editor-inverse-scale': String(inverseScale),
    '--wc-editor-stroke-width': `${strokeWidth}px`,
  } as CSSProperties

  return (
    <div className={`wc-selection-outline wc-selection-outline--${kind}`} style={style}>
      <span className="wc-selection-outline__label">{target.label}</span>
    </div>
  )
}

export function WebComposerSelectionOverlay({
  rootRef,
  hovered,
  selected,
  enabled,
  displayScale,
  onSelectedMetrics,
}: {
  rootRef: RefObject<HTMLElement>
  hovered: WebComposerSelectionTarget | null
  selected: WebComposerSelectionTarget | null
  enabled: boolean
  displayScale: number
  onSelectedMetrics: (slotId: string, rect: WebComposerSlotRect) => void
}) {
  const [frame, setFrame] = useState<OverlayFrame>(emptyFrame)
  const [selectedIndicatorVisible, setSelectedIndicatorVisible] = useState(false)
  const [selectedIndicatorToken, setSelectedIndicatorToken] = useState(0)
  const lastMetricsRef = useRef<{ slotId: string; rect: WebComposerSlotRect } | null>(null)

  useEffect(() => {
    if (!enabled || !selected) {
      setSelectedIndicatorVisible(false)
      return
    }

    setSelectedIndicatorVisible(true)
    setSelectedIndicatorToken((token) => token + 1)
    const timeout = window.setTimeout(() => setSelectedIndicatorVisible(false), selectionIndicatorDurationMs)
    return () => window.clearTimeout(timeout)
  }, [enabled, selected])

  useEffect(() => {
    if (!enabled || (!hovered && !selected)) {
      setFrame((current) => sameFrame(current, emptyFrame) ? current : emptyFrame)
      lastMetricsRef.current = null
      return
    }

    let animationFrame = 0
    const update = () => {
      const root = rootRef.current
      const next = root
        ? { hovered: measureTarget(root, hovered), selected: measureTarget(root, selected) }
        : emptyFrame
      setFrame((current) => sameFrame(current, next) ? current : next)

      if (next.selected) {
        const rect = {
          x: next.selected.x,
          y: next.selected.y,
          width: next.selected.width,
          height: next.selected.height,
        }
        const last = lastMetricsRef.current
        const changed = !last
          || last.slotId !== next.selected.slotId
          || !sameNumber(last.rect.x, rect.x)
          || !sameNumber(last.rect.y, rect.y)
          || !sameNumber(last.rect.width, rect.width)
          || !sameNumber(last.rect.height, rect.height)
        if (changed) {
          lastMetricsRef.current = { slotId: next.selected.slotId, rect }
          onSelectedMetrics(next.selected.slotId, rect)
        }
      } else {
        lastMetricsRef.current = null
      }
      animationFrame = window.requestAnimationFrame(update)
    }

    update()
    return () => window.cancelAnimationFrame(animationFrame)
  }, [enabled, hovered, onSelectedMetrics, rootRef, selected])

  if (!enabled) return null
  const inverseScale = 1 / Math.max(0.05, Math.min(1, displayScale))
  const hoveredTarget = frame.hovered?.element === frame.selected?.element ? null : frame.hovered

  return (
    <div className="wc-selection-layer" data-html2canvas-ignore="true" aria-hidden="true">
      {hoveredTarget && <Outline target={hoveredTarget} kind="hovered" inverseScale={inverseScale} />}
      {frame.selected && selectedIndicatorVisible && (
        <Outline
          key={`${frame.selected.slotId}-${selectedIndicatorToken}`}
          target={frame.selected}
          kind="selected"
          inverseScale={inverseScale}
        />
      )}
    </div>
  )
}
