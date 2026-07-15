import { describe, expect, it } from 'vitest'

import { WEB_COMPOSER_ASPECT_RATIO_OPTIONS } from '@mediatoolbox/contracts'

import { aspectRatioOptions, createExportSettings, createInitialPresetStates, resizeExportSettings, targetSize } from './model'

describe('web composer model', () => {
  it('keeps target viewport dimensions independent from the visible app window', () => {
    expect(targetSize('16:9', '1080p')).toEqual({ width: 1920, height: 1080 })
    expect(targetSize('1.91:1', '1080p')).toEqual({ width: 2063, height: 1080 })
    expect(targetSize('4:3', '1080p')).toEqual({ width: 1440, height: 1080 })
    expect(targetSize('9:16', '1080p')).toEqual({ width: 1080, height: 1920 })
    expect(targetSize('1:1.91', '1080p')).toEqual({ width: 1080, height: 2063 })
  })

  it('uses the shared seven-ratio catalog without orientation labels', () => {
    expect(aspectRatioOptions).toBe(WEB_COMPOSER_ASPECT_RATIO_OPTIONS)
    expect(aspectRatioOptions.map((option) => option.label)).toEqual([
      '16:9', '9:16', '1.91:1', '1:1.91', '4:3', '3:4', '1:1',
    ])
  })

  it('recomputes dimensions when the output preset changes', () => {
    const current = createExportSettings()
    expect(resizeExportSettings(current, { aspectRatio: '1:1', resolution: '720p' })).toMatchObject({
      width: 720,
      height: 720,
      fps: 30,
      durationSeconds: 10,
    })
  })

  it('lazily creates independent mutable state for the initial preset', () => {
    const first = createInitialPresetStates()
    const second = createInitialPresetStates()
    const badge = first.lumora?.slots['hero.badge']?.text
    if (badge) badge.value = 'changed'
    expect(second.lumora?.slots['hero.badge']?.text?.value).toContain('10,000')
    expect(Object.keys(first)).toEqual(['lumora'])
  })
})
