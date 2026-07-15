import type {
  WebComposerAspectRatio,
  WebComposerExportResolution,
  WebComposerExportSettings,
  WebComposerPresetId,
  WebComposerPresetState,
} from '@mediatoolbox/contracts'
import { WEB_COMPOSER_ASPECT_RATIO_OPTIONS } from '@mediatoolbox/contracts'

import { clonePresetState, presets } from './presets'

export const aspectRatioOptions = WEB_COMPOSER_ASPECT_RATIO_OPTIONS

export const resolutionOptions: Array<{ value: WebComposerExportResolution; label: string; pixels: number }> = [
  { value: '720p', label: '720P', pixels: 720 },
  { value: '1080p', label: '1080P', pixels: 1080 },
  { value: '1440p', label: '1440P', pixels: 1440 },
  { value: '2160p', label: '4K', pixels: 2160 },
]

export function targetSize(aspectRatio: WebComposerAspectRatio, resolution: WebComposerExportResolution) {
  const ratioOption = aspectRatioOptions.find((option) => option.value === aspectRatio) ?? aspectRatioOptions[0]
  const resolutionOption = resolutionOptions.find((option) => option.value === resolution) ?? resolutionOptions[1]
  const ratio = ratioOption.width / ratioOption.height
  return ratio < 1
    ? { width: resolutionOption.pixels, height: Math.round(resolutionOption.pixels / ratio) }
    : { width: Math.round(resolutionOption.pixels * ratio), height: resolutionOption.pixels }
}

export function createExportSettings(
  aspectRatio: WebComposerAspectRatio = '16:9',
  resolution: WebComposerExportResolution = '1080p',
): WebComposerExportSettings {
  return {
    aspectRatio,
    resolution,
    ...targetSize(aspectRatio, resolution),
    fps: 30,
    durationSeconds: 10,
  }
}

export function resizeExportSettings(
  current: WebComposerExportSettings,
  next: Partial<Pick<WebComposerExportSettings, 'aspectRatio' | 'resolution'>>,
): WebComposerExportSettings {
  const aspectRatio = next.aspectRatio ?? current.aspectRatio
  const resolution = next.resolution ?? current.resolution
  return { ...current, aspectRatio, resolution, ...targetSize(aspectRatio, resolution) }
}

export function createInitialPresetStates(): Partial<Record<WebComposerPresetId, WebComposerPresetState>> {
  const firstPreset = presets[0]
  return { [firstPreset.id]: clonePresetState(firstPreset.defaults) }
}

export function createPreviewSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `wc-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export function previewRuntimeUrl(sessionId: string) {
  // Resolve against the site origin rather than document.baseURI: the preview
  // runtime is always served from the site root (web-composer-preview.html),
  // but document.baseURI reflects the current route path (e.g. /preset/lumora),
  // which would otherwise mis-resolve this relative reference.
  const url = new URL('/web-composer-preview.html', window.location.origin)
  url.searchParams.set('session', sessionId)
  return url.href
}
