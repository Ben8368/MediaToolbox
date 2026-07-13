import type {
  WebComposerAspectRatio,
  WebComposerExportResolution,
  WebComposerExportSettings,
  WebComposerPresetId,
  WebComposerPresetState,
} from '@mediatoolbox/contracts'

import { clonePresetState, presets } from './presets'

export const aspectRatioOptions: Array<{ value: WebComposerAspectRatio; label: string; width: number; height: number }> = [
  { value: '16:9', label: '16:9 横屏', width: 16, height: 9 },
  { value: '4:3', label: '4:3 经典', width: 4, height: 3 },
  { value: '1:1', label: '1:1 方图', width: 1, height: 1 },
  { value: '9:16', label: '9:16 竖屏', width: 9, height: 16 },
]

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
    fps: 12,
    durationSeconds: 4,
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
  const url = new URL('web-composer-preview.html', document.baseURI)
  url.searchParams.set('session', sessionId)
  return url.href
}
