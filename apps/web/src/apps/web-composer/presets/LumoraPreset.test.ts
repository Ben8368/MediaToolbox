import { describe, expect, it } from 'vitest'

import { lumoraVideos, resolveLumoraBackgroundSource } from './LumoraPreset'

describe('Lumora background switcher', () => {
  it('uses the selected built-in scene when the background slot has its default source', () => {
    for (const [index, video] of lumoraVideos.entries()) {
      expect(resolveLumoraBackgroundSource(index, lumoraVideos[0].src)).toBe(video.src)
    }
  })

  it('keeps an explicitly replaced background source', () => {
    expect(resolveLumoraBackgroundSource(2, 'blob:custom-background')).toBe('blob:custom-background')
  })
})
