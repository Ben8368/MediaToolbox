import type { CSSProperties } from 'react'
import type { WebComposerPresetState, WebComposerSlotValue } from '@mediatoolbox/contracts'

import { WebComposerIcon } from '../WebComposerIcon'

export const systemFont = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type PresetViewport = {
  width: number
  height: number
  designWidth: number
  designHeight: number
}

type SlotStyle = CSSProperties & {
  '--wc-slot-offset-x'?: string
  '--wc-slot-offset-y'?: string
}

export function getMediaProps(url: string) {
  return url.startsWith('blob:') ? {} : { crossOrigin: 'anonymous' as const }
}

export function getSlot(state: WebComposerPresetState, slotId: string): WebComposerSlotValue | undefined {
  return state.slots[slotId]
}

export function getText(state: WebComposerPresetState, slotId: string) {
  return state.slots[slotId]?.text?.value ?? ''
}

export function getMedia(state: WebComposerPresetState, slotId = 'background') {
  return state.slots[slotId]?.media
}

export function resolveBuiltInBackgroundSource(
  sources: readonly { src: string }[],
  activeIndex: number,
  backgroundSrc?: string,
) {
  const defaultSource = sources[0]
  const selectedSource = sources[activeIndex] ?? defaultSource

  // A manifest default establishes the initial editable background, rather
  // than pinning the switcher to its first built-in scene. Explicit user
  // replacements always take precedence over the switcher.
  if (!backgroundSrc || backgroundSrc === defaultSource?.src) return selectedSource?.src ?? ''

  return backgroundSrc
}

function canvasScale(viewport: PresetViewport) {
  return {
    x: viewport.width / viewport.designWidth,
    y: viewport.height / viewport.designHeight,
    uniform: Math.min(viewport.width / viewport.designWidth, viewport.height / viewport.designHeight),
  }
}

export function slotElementProps(state: WebComposerPresetState, slotId: string, viewport: PresetViewport, baseStyle: CSSProperties = {}) {
  const slot = getSlot(state, slotId)
  const scale = canvasScale(viewport)
  const style: SlotStyle = {
    ...baseStyle,
    '--wc-slot-offset-x': `${(slot?.offset.x ?? 0) * scale.x}px`,
    '--wc-slot-offset-y': `${(slot?.offset.y ?? 0) * scale.y}px`,
    visibility: slot?.visible === false ? 'hidden' : baseStyle.visibility,
  }

  if (slot?.activeKind === 'text' && slot.text) {
    if (slot.text.fontFamily) style.fontFamily = slot.text.fontFamily
    if (slot.text.fontSize !== null) style.fontSize = `${slot.text.fontSize * scale.uniform}px`
    if (slot.text.fontWeight !== null) style.fontWeight = slot.text.fontWeight
    if (slot.text.color) style.color = slot.text.color
  } else if (slot?.activeKind === 'icon' && slot.icon?.color) {
    style.color = slot.icon.color
  }

  return {
    'data-wc-slot': slotId,
    'data-wc-slot-kind': slot?.activeKind ?? 'text',
    'data-wc-slot-hidden': slot?.visible === false ? 'true' : undefined,
    style,
  } as const
}

export function PresetSlotContent({ state, slotId, viewport, iconClassName, imageClassName }: {
  state: WebComposerPresetState
  slotId: string
  viewport: PresetViewport
  iconClassName?: string
  imageClassName?: string
}) {
  const slot = getSlot(state, slotId)
  if (!slot) return null
  const scale = canvasScale(viewport).uniform

  if (slot.activeKind === 'icon' && slot.icon) {
    return (
      <WebComposerIcon
        iconId={slot.icon.iconId}
        className={iconClassName}
        size={slot.icon.size === null ? undefined : slot.icon.size * scale}
        style={slot.icon.color ? { color: slot.icon.color } : undefined}
      />
    )
  }

  if (slot.activeKind === 'image' && slot.image?.src.trim()) {
    const width = slot.image.width === null ? null : slot.image.width * scale
    const height = slot.image.height === null ? null : slot.image.height * scale
    return (
      <img
        className={imageClassName ?? 'wc-preset-slot-image'}
        src={slot.image.src}
        alt={slot.image.alt}
        style={{
          width: width ?? (height === null ? undefined : 'auto'),
          height: height ?? (width === null ? undefined : 'auto'),
          objectFit: slot.image.fit,
        }}
        {...getMediaProps(slot.image.src)}
      />
    )
  }

  return <>{slot.text?.value ?? ''}</>
}

export function MediaBackground({ state, viewport, slotId = 'background' }: {
  state: WebComposerPresetState
  viewport: PresetViewport
  slotId?: string
}) {
  const media = getMedia(state, slotId)
  if (!media) return null
  const editableProps = slotElementProps(state, slotId, viewport)

  if (media.kind === 'image') {
    return (
      <img
        className="preset-bg-media"
        src={media.src}
        alt=""
        aria-hidden="true"
        {...getMediaProps(media.src)}
        {...editableProps}
        style={{ ...editableProps.style, objectFit: media.fit }}
      />
    )
  }

  return (
    <video
      className="preset-bg-media"
      src={media.src}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
      {...getMediaProps(media.src)}
      {...editableProps}
      style={{ ...editableProps.style, objectFit: media.fit }}
    />
  )
}
