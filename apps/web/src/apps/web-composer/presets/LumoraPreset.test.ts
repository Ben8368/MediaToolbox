import { describe, expect, it } from 'vitest'

import { lumoraVideos } from './LumoraPreset'
import { viktorVideos } from './ViktorPreset'
import { resolveBuiltInBackgroundSource } from './shared'

describe('built-in background switchers', () => {
  it.each([
    ['Lumora', lumoraVideos],
    ['Viktor', viktorVideos],
  ])('%s uses the selected built-in scene when the background slot has its default source', (_name, sources) => {
    for (const [index, video] of sources.entries()) {
      expect(resolveBuiltInBackgroundSource(sources, index, sources[0].src)).toBe(video.src)
    }
  })

  it.each([[lumoraVideos], [viktorVideos]])('keeps an explicitly replaced background source', (sources) => {
    expect(resolveBuiltInBackgroundSource(sources, 2, 'blob:custom-background')).toBe('blob:custom-background')
  })
})
